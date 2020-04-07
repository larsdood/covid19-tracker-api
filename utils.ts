export function naiveObjectComparison(objOne: object, objTwo: object): boolean {
  return JSON.stringify(objOne) === JSON.stringify(objTwo);
}