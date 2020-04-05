## GraphQL Quote Cache

Simple GraphQL-based cache, backed by REDIS, or local in-memory object

### Sample config

    {
      "workers": 1,
      "server": {
        "keepAlive": 2700000,
        "port": 80
      },
      "defaultCollection": "CACHE_LOCAL",
      "collections": {
        "CACHE_LOCAL": {
          "type": "local"
        },
        "CACHE_REDIS": {
          "type": "redis",
          "options": {
            "redis": {
              "host": "REDIS_HOST",
              "port": 6379
            }
          }
        }
      }
    }