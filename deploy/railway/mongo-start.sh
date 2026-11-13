#!/bin/bash
set -euo pipefail
: "${MONGO_ADMIN_PASSWORD:?required}"
: "${MONGO_KEYFILE:?required}"
: "${RAILWAY_PRIVATE_DOMAIN:?required}"
printf '%s' "$MONGO_KEYFILE" > /tmp/railway-mongo.key
chmod 600 /tmp/railway-mongo.key
chown mongodb:mongodb /tmp/railway-mongo.key
/usr/local/bin/docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --ipv6 --keyFile /tmp/railway-mongo.key --wiredTigerCacheSizeGB 0.25 --oplogSize 64 &
mongo_pid=$!
trap 'kill -TERM "$mongo_pid" 2>/dev/null || true; wait "$mongo_pid"' TERM INT
# On first start, the localhost exception allows replica-set setup and creation of the administrator.
for attempt in {1..60}; do
  if mongosh --quiet --host 127.0.0.1 --eval '
    const admin = db.getSiblingDB("admin");
    let authenticated = false;
    try { authenticated = !!admin.auth("appadmin", process.env.MONGO_ADMIN_PASSWORD); } catch(e) {
      if (e.code !== 18) throw e;
    }
    // A loopback member avoids Railway DNS pointing at the previous container during restart.
    // The app intentionally uses directConnection=true against the private service hostname.
    let config;
    try {
      config = rs.conf();
      // Some mongosh versions return an error document instead of throwing it.
      if (!config?.members?.length) throw (config || {code:94});
    } catch(e) {
      config = undefined;
      // With keyFile authentication, a fresh node can reject rs.conf with
      // Unauthorized (13) before the localhost bootstrap exception is used.
      // Only attempt bootstrap when authentication has not succeeded; no
      // authentication or network protection is ever disabled.
      if (e.code !== 94 && !(e.code === 13 && !authenticated)) throw e;
      try {
        rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]});
      } catch (initError) {
        // A previous attempt may have initialized the replica set before
        // creating the first user. Existing users with a wrong password
        // still fail authorization; never reset their credentials or data.
        if (initError.code !== 23) throw initError;
      }
    }
    if (config?.members?.[0] && config.members[0].host !== "localhost:27017") {
      config.members[0].host = "localhost:27017";
      config.version++;
      rs.reconfig(config, {force:true});
    }
    for (let n=0; n<30 && !db.hello().isWritablePrimary; n++) sleep(1000);
    if (!db.hello().isWritablePrimary) throw new Error("Primary not ready");
    if (!authenticated) {
      admin.createUser({user:"appadmin",pwd:process.env.MONGO_ADMIN_PASSWORD,roles:[{role:"root",db:"admin"}]});
    }
  '; then break; fi
  if ! kill -0 "$mongo_pid" 2>/dev/null; then wait "$mongo_pid"; exit 1; fi
  sleep 2
done
# Require authenticated access before calling initialization complete.
mongosh --quiet --eval '
  const c = new Mongo("mongodb://appadmin:"+encodeURIComponent(process.env.MONGO_ADMIN_PASSWORD)+"@127.0.0.1:27017/admin?directConnection=true");
  if (!c.getDB("admin").runCommand({hello:1}).isWritablePrimary) throw new Error("Primary not ready");
  print("Railway MongoDB replica set ready");
'
wait "$mongo_pid"

