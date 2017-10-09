import DragDropSet from './set';

export default DragDropSet.extend({
  layoutName: 'components/drag-drop/set',

  _removeItem(itemKeyToRemove) {
    const itemIndex = this._getItemIndexByKey(itemKeyToRemove);
    const items = this.get('items');
    items.removeAt(itemIndex, 1);
  },

  _insertItem(dragOverItemKey, itemToAdd) {
    const dropItemIndex = this._getItemIndexByKey(dragOverItemKey);
    const items = this.get('items');
    items.replace(dropItemIndex, 0, [itemToAdd]);
  }
});
