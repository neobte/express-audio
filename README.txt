Express Audio

// cantidad de elementos requeridos
const n = 5;

// Verificación
const limit = Math.min(n, array.length);

const newArr = new Array(limit);

for(let i = 0; i < limit; i++) {
    newArr[i] = array[i];
}