import express = require('express')
const ExpressCache = require('express-cache-middleware');
const cacheManager = require('cache-manager');
const fs = require('fs');
const expressSwagger = require('express-swagger-generator')(app)
import moment from 'moment';
import { Observable } from 'rxjs';
import { select } from 'proxjs';
import { Store } from './store';
import { select$ } from './select$';
require ('dotenv').config();
import { timeseriesDateRegex } from './regex';
import { makeSwaggerOptions } from './make-swagger-options';

interface TimeseriesEntry {
  date: string;
  confirmed: number;
  deaths: number;
  recovered: number;
}

interface Accumulated {
  confirmed: number;
  deaths: number;
  recovered: number;
}

interface Timeseries {
  [countryname: string]: TimeseriesEntry[]
}

interface SpecificDateSeries {
  [countryname: string]: TimeseriesEntry
}

let timeseries$: Store<Timeseries>;

if (process.env.PRODUCTION === 'true' || true) {
  const fetch = require('node-fetch');
  timeseries$ = new Store({} as Timeseries);
  const options = {
    url: 'https://pomber.github.io/covid19/timeseries.json',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  }
  fetch('https://pomber.github.io/covid19/timeseries.json')
    .then((res: any) => res.json)
    .then((json: Timeseries) => timeseries$.next(json));

} else {
  const rawdata = fs.readFileSync('./static/timeseries_2020-APR-07.json');
  const timeseries: Timeseries = JSON.parse(rawdata);
  timeseries$ = new Store(timeseries);

  console.log('this is dev!')
}

expressSwagger(makeSwaggerOptions());

const latest$: Observable<SpecificDateSeries> = select$(
  timeseries$,
  series => Object.entries(series).reduce((latestDict, [countryname, datalist] ) => Object.assign(
    {},
    latestDict,
    {
      [countryname]: datalist[datalist.length - 1]
    }
  ), {})
);

const onDate$ = (date: string): Observable<SpecificDateSeries> => select$(
  timeseries$,
  series => Object.entries(series).reduce((latestDict, [countryname, datalist] ) => Object.assign(
    {},
    latestDict,
    {
      [countryname]: datalist.find(entry => entry.date === date)
    }
  ), {})
)

const accumulated$: Observable<Accumulated> = select$(
  latest$,
  latestEntries => Object.values(latestEntries).reduce((accumulated, entry) => ({
    confirmed: accumulated.confirmed + entry.confirmed,
    deaths: accumulated.deaths + entry.deaths,
    recovered: accumulated.recovered + entry.recovered,
  }), {
    confirmed: 0,
    deaths: 0,
    recovered: 0
  })
);

const accumulatedOnDate$ = (date: string): Observable<Accumulated> => select$(
  onDate$(date),
  onDate => Object.values(onDate).reduce((accumulated, entry) => ({
    confirmed: accumulated.confirmed + entry.confirmed,
    deaths: accumulated.deaths + entry.deaths,
    recovered: accumulated.recovered + entry.recovered,
  }), {
    confirmed: 0,
    deaths: 0,
    recovered: 0
  })
);

const latestDateInCollection$: Observable<string> = select$(
  latest$,
  latestEntries => Object.values(latestEntries).reduce((latestDate, { date }) => 
    moment.max(moment(latestDate), moment(date, 'YYYY-MM-DD'))
  , moment(0)
  ).format('YYYY-MM-DD')
);

const app = express();

const cacheMiddleware = new ExpressCache(
  cacheManager.caching({
    store: 'memory', max: 1000, ttl: 3600
  })
);

cacheMiddleware.attach(app);

app.use(express.json());

app.get('', (_req: express.Request, res: express.Response) => {
  res.redirect('/api-docs')
});

/**
 * returns latest data for each country in the list
 * @route GET /latest
 * @returns {object} 200 - a dict with the latest stat for each country
 * @returns {Error} default - Unexpected error
 */
app.get('/latest', (_req: express.Request, res: express.Response) => {
  const latest = select(latest$);
  return res.send(latest);
});

/**
 * returns latest data for a specific country
 * @route GET /latest/:country
 * @param {string} country.query.required the name of the country
 * @returns {object} 200 - an object with infected, deaths and recovered for that country
 * @returns {Error} default - Unexpected error
 */
app.get('/latest/:country', (req: express.Request, res: express.Response) => {
  const country: string = req.params.country;
  if (!country) {
    return res.status(404).send({
      error: "no country given"
    });
  }
  const latest = select(latest$);
  const countryData: TimeseriesEntry = latest[country];
  if (!countryData) {
    return res.status(404).send({
      error: "could not find country " + country
    });
  }
  if (!latest) {
    return res.status(404).send({
      error: "could not find latest data for " + country
    })
  }
  return res.json({
    type: "latest",
    country,
    ...latest
  });
});

/**
 * return all countries data for the specific date
 * @route GET /date/:date
 * @param {string} date.query.required the specified date (string of format YYYY-MM-DD)
 * @returns {object} 200 - a dict with stats on each country on the specific date
 * @returns {Error} default - Unexpected error
 */
  let { date } = req.params;
  if (!timeseriesDateRegex.test(date)) {
    return res.status(403).send({
      error: 'date must be on format YYYY-MM-DD'
    })
  };
  // in case requests put a 0 in front of day or month which is not in dataset
  // we want to allow this.
  date = date.replace('-0', '-');
  const onDate = select(onDate$(date));
  res.send(onDate);
});

/**
 * return all countries data for the specific date
 * @route GET /accumulated
 * @returns {object} 200 - an object with accumulated infections, deaths, recovered on the latest date
 * @returns {Error} default - Unexpected error
 */
  const accumulated = select(accumulated$);
  const latestDateInCollection = select(latestDateInCollection$);
  return res.send({
    type: "accumulated",
    date: latestDateInCollection,
    ...accumulated });
});

/**
 * return all countries data for the specific date
 * @route GET /accumulated/:date
 * @param {string} date.query.required the specified date (string of format YYYY-MM-DD)
 * @returns {object} 200 - an object with accumulated infections, deaths, recovered on the specified date
 * @returns {Error} default - Unexpected error
 */
  const accumulatedOnDate = select(accumulatedOnDate$(date));
  return res.send(
    {
      type: "accumulated",
      date,
      ...accumulatedOnDate
    }
  );
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
