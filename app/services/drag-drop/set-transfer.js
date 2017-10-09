import Ember from 'ember';

export default Ember.Service.extend({
  sourceSet: null,        // a pointer to the set component where the drag started
  draggedItem: null,      // the "dragScope" of of the item being dragged

  setData({ setComponent, draggedItem }) {
    this.set('sourceSet', setComponent);
    this.set('draggedItem', draggedItem);
  },

  getData() {
    return {
      sourceSet: this.get('sourceSet'),
      draggedItem: this.get('draggedItem')
    };
  },

  transfer({ targetSet, targetItemKey }) {
    const { sourceSet, draggedItem } = this.getData();

    if (sourceSet && targetSet && draggedItem && targetSet !== sourceSet) {
      const draggedItemKey = Ember.get(draggedItem, 'sortKey');

      sourceSet.removeItemForTransfer({
        itemKeyToRemove: draggedItemKey
      });
      targetSet.insertItemForTransfer({
        itemToAdd: draggedItem,
        itemKeyToAdd: draggedItemKey,
        dragOverItemKey: targetItemKey
      });

      // TODO(kapil) this shouldn't break if the above insert/removes don't work
      // reset the data, including re-fetching the draggedItem in case it's a new reference
      this.setData({
        setComponent: targetSet,
        draggedItem: targetSet.get('items').findBy('sortKey', draggedItemKey)
      });
    }
  },

  clearData() {
    this.set('sourceSet', null);
    this.set('draggedItem', null);
  }
});
