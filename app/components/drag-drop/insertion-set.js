import ArraySet from './array-set';

export default ArraySet.extend({
  layoutName: 'components/drag-drop/set',

  _sortItems(dragKey, dropKey) {
    const dragIndex = this._getItemIndexByKey(dragKey);
    const dropIndex = this._getItemIndexByKey(dropKey);

    // Use Ember's special mutation functions so the property
    // is updated and the template re-renders
    // See http://emberjs.com/api/classes/Ember.MutableArray.html
    const items = this.get('items');
    const draggedItem = items[dragIndex];
    items.removeAt(dragIndex, 1);
    items.replace(dropIndex, 0, [draggedItem]);
  }
});
