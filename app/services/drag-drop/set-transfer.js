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

  clearData() {
    this.set('sourceSet', null);
    this.set('draggedItem', null);
  }
});
