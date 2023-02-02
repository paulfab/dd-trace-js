const tracer = require('dd-trace').init();

const express = require('express');
const Redis = require('redis');
const redis = Redis.createClient();

const app = express();
const PORT = 3000;

redis.connect();

// setTimeout(() => {
//   console.log('REQUIRE CACHE', require.cache);
// }, 1000);

app.get('/', (req, res) => {
  redis.incr('my-counter')
    .then((result) => {
      res.status(200).type('json').send({result});
    })
    .catch((err) => {
      res.status(500).type('json').send({error: err.message});
    });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
