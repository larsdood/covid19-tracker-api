import { BehaviorSubject } from "rxjs"; 
import { naiveObjectComparison } from './utils';

function deepFreeze<T extends object>(inObj: T): T {
  Object.freeze(inObj);

  Object.getOwnPropertyNames(inObj).forEach(function (prop) {
    if (inObj.hasOwnProperty
      && inObj.hasOwnProperty(prop)
      //@ts-ignore
      && inObj[prop] != null
      //@ts-ignore
      && typeof inObj[prop] === 'object'
      //@ts-ignore
      && !Object.isFrozen(inObj[prop])) {
      //@ts-ignore
        deepFreeze(inObj[prop]);
      }
  });
  return inObj;
}

export class Store<T extends object> extends BehaviorSubject<T> {
  constructor(initialData: T) {
    super(deepFreeze(initialData));
  }

  next(newData: T): void {
    const frozenData = deepFreeze(newData);
    if (!naiveObjectComparison(frozenData, this.getValue())) {
      super.next(frozenData);
    }
  }
}