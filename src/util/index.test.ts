import { classnames, setIn } from ".";

test('setIn', () => {
  const options = {};
  setIn(options, ['level'], 1);
  expect(options).toStrictEqual({ level: 1 });

  setIn(options, ['game', 'name'], 'Test Game');
  expect(options).toStrictEqual({ level: 1, game: { name: 'Test Game' }});
});

test('classnames', () => {
  console.log(classnames({ a: true, b: false }, [{ c: true }], undefined, [[['hi', {name: true}]]]));
});
