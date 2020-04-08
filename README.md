# Covid tracker api

An express API that exposes the data from pomber/covid (https://github.com/pomber/covid19) through RESTFUL endpoints. Current work in progress (started 8th of april 2020).

I was looking for something similar as I figured maybe I'd want to try and write algorithms for showing increase/decline in various countries, but was surprised not to find something like this.

Instead, I found a repository that maintains an updated JSON file with stats.

So I wrote an express API to expose this.

@@ TODO:
Handling of country names. maybe need a dict for country codes etc? right now the JSON object has country names in a specific format that is not very helpful for devs
