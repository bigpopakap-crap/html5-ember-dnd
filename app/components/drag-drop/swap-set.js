import ArraySet from './array-set';

function indexOf(arr, propName, propVal) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i][propName] === propVal) {
      return i;
    }
  }

  return -1;
}

function swap(arr, i, j) {
  const iItem = arr[i];
  const jItem = arr[j];

  arr.replace(i, 1, jItem)
     .replace(j, 1, iItem);
}

export default ArraySet.extend({
  layoutName: 'components/drag-drop/set',

  _sortItems(dragKey, dropKey) {
    const items = this.get('items');
    const dragIndex = indexOf(items, 'key', dragKey);
    const dropIndex = indexOf(items, 'key', dropKey);
    swap(items, dragIndex, dropIndex);
  }
});
