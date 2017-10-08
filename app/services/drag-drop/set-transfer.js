import Ember from 'ember';

export default Ember.Service.extend({
  sourceSet: null,        // a pointer to the set component where the drag started
  sourceSetSortProperty: null, // the sortKey attribute of the source set
  draggedItem: null,      // the "dragScope" of of the item being dragged

  setData({ setComponent, sortProperty, draggedItem }) {
    this.set('sourceSet', setComponent);
    this.set('sourceSetSortProperty', sortProperty);
    this.set('draggedItem', draggedItem);
  },

  getData() {
    return {
      sourceSet: this.get('sourceSet'),
      sourceSetSortProperty: this.get('sourceSetSortProperty'),
      draggedItem: this.get('draggedItem')
    };
  },

  clearData() {
    this.set('sourceSet', null);
    this.set('sourceSetSortProperty', null);
    this.set('draggedItem', null);
  }
});
