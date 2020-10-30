import React from 'react';
import { render } from '@testing-library/react';
import App, { traceChain, getTileChains } from './App';
import type { GameState } from './App';


const Game: GameState = { 
    "pool": ["A", "A", "A", "A", "A", "A", "A", "A", "A", "B", "B", "C", "C", "D", "D", "D", "D", "E", "E", "E", "E", "E", "E", "E", "E", "E", "E", "F", "F", "G", "G", "G", "H", "H", "I", "I", "I", "I", "I", "I", "I", "J", "K", "L", "L", "L", "M", "M", "N", "N", "N", "N", "O", "O", "O", "O", "O", "O", "O", "O", "P", "P", "Q", "R", "R", "R", "R", "R", "S", "S", "S", "S", "T", "T", "T", "T", "T", "T", "U", "U", "U", "U", "V", "W", "W", "X", "Y", "Y", "Z", "Blank", "Blank"], 
    "board": [
        [null, { "id": 1 }, null, null], 
        [null, { "id": 2 }, null, null], 
        [null, { "id": 3 }, null, null], 
        [null, { "id": 4 }, null, null], 
        [{ "id": 9 }, { "id": 5 }, { "id": 8 }, { "id": 7 }], 
        [null, { "id": 6 }, null, null], 
        [null, null, null, null], 
        [null, null, null, null], 
        [null, null, null, null], 
        [null, null, null, null]],
     "columns": 4, "rows": 10, "selectedColumn": 1, "dropping": null, "_nextId": 10, "swapping": null, 
     "pieces": { 
         "1": { "id": 1, "letter": "I", "type": "tile", "x": 1, "y": 0 }, 
         "2": { "id": 2, "letter": "I", "type": "tile", "x": 1, "y": 1 }, 
         "3": { "id": 3, "letter": "E", "type": "tile", "x": 1, "y": 2 }, 
         "4": { "id": 4, "letter": "R", "type": "tile", "x": 1, "y": 3 }, 
         "5": { "id": 5, "letter": "E", "type": "tile", "x": 1, "y": 4 }, 
         "6": { "id": 6, "letter": "N", "type": "tile", "x": 1, "y": 5 }, 
         "7": { "id": 7, "letter": "L", "type": "tile", "x": 3, "y": 4 }, 
         "8": { "id": 8, "letter": "V", "type": "tile", "x": 2, "y": 4 }, 
         "9": { "id": 9, "letter": "N", "type": "tile", "x": 0, "y": 4 } } 
        };

test('trace tile chain', () => {
    expect(traceChain(Game, [1, 0], [0, 1])).toStrictEqual([[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]]);
});

test('find sequences', () => {
        const tileStrings = getTileChains(Game, [1, 0]);

        console.log(tileStrings);
        const strings = tileStrings.map(
            tileString => tileString.map(t => t.type === 'tile' ? t.letter : '').join('')
        );
        expect(strings).toContain('NEREII');
        // expect(strings).toContain('NEVL');
})