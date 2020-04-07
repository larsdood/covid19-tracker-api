import express = require('express')
const ExpressCache = require('express-cache-middleware');
const cacheManager = require('cache-manager');
const fs = require('fs');
import moment from 'moment';
import { Observable } from 'rxjs';
import { select } from 'proxjs';
import { Store } from './store';
import { select$ } from './select$';
require ('dotenv').config();
import { timeseriesDateRegex } from './regex';

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

app.get('', (req: express.Request, res: express.Response) => {
  res.send('SWAGGER HERE PLS')
});

/**
 * returns latest data for each country in the list
 */
app.get('/latest', (_req: express.Request, res: express.Response) => {
  const latest = select(latest$);
  return res.send(latest);
});

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
  // const latest: TimeseriesEntry = countryData[countryData.length - 1];
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

app.get('/date/:date', (req: express.Request, res: express.Response) => {
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

app.get('/accumulated', (req: express.Request, res: express.Response) => {
  const accumulated = select(accumulated$);
  const latestDateInCollection = select(latestDateInCollection$);
  return res.send({
    type: "accumulated",
    date: latestDateInCollection,
    ...accumulated });
});

app.get('/accumulated/:date', (req: express.Request, res: express.Response) => {
  let { date } = req.params;
  if (!timeseriesDateRegex.test(date)) {
    return res.status(403).send({
      error: 'date must be on format YYYY-MM-DD'
    })
  };
  // in case requests put a 0 in front of day or month which is not in dataset
  // we want to allow this.
  date = date.replace('-0', '-');
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
