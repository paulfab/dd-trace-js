#!/usr/bin/env node

const tracer = require('dd-trace').init();
const assert = require('assert')
const express = require('express')
const redis = require('redis')
const app = express()
const PORT = 3000
const pg = require('pg')
const pgp = require('pg-promise')() // transient dep of 'pg'

assert.equal(redis.Graph.name, 'Graph')
assert.equal(pg.types.builtins.BOOL, 16)
assert.equal(express.static.mime.types.ogg, 'audio/ogg')

console.log('REDIS INJECTED?', redis.__DATADOG_VERSION);
console.log('PG INJECTED?', pg.__DATADOG_VERSION);
console.log('EXPRESS INJECTED?', express.__DATADOG_VERSION);

const conn = {
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'hunter2',
  port: 5433,
};

console.log('pg connect')
const client = new pg.Client(conn)
client.connect()

console.log('pg-promise connect')
const client2 = pgp(conn)

app.get('/', async (req, res) => {
  const query = await client.query('SELECT NOW() AS now')
  const query2 = await client2.query('SELECT NOW() AS now')
  res.json({
    "connection_pg": query.rows[0].now,
    "connection_pg_promise": query2[0].now,
  })
})

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
})
