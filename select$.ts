import { Observable } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { naiveObjectComparison } from './utils';

type MappingFunction<T, R> = (mappable: T) => R;
type MemoizationFunction<R> = (previousResult: R, currentResult: R) => boolean;


function defaultMemoization(previousValue: any, currentValue: any): boolean {
  if (typeof previousValue === 'object' && typeof currentValue === 'object') {
    return naiveObjectComparison(previousValue, currentValue);
  }
  return previousValue === currentValue;
}

export function select$<T, R> (
  source$: Observable<T>,
  mappingFunction: MappingFunction<T, R>,
  memoizationFunction?: MemoizationFunction<R>
): Observable<R> {
  return source$.pipe(
    map(mappingFunction),
    distinctUntilChanged(memoizationFunction || defaultMemoization),
    shareReplay(1)
  )
}