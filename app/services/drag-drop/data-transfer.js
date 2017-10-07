import Ember from 'ember';

export default Ember.Service.extend({
  _dragData: null,        // the "data" attribute of the item being dragged
  _dragScope: null,       // the "dragScope" of of the item being dragged

  setData({ dragData, dragScope }) {
    this.set('_dragData', dragData);
    this.set('_dragScope', dragScope);
  },

  getData() {
    return {
      dragData: this.get('_dragData'),
      dragScope: this.get('dragScope')
    };
  },

  clearData() {
    this.set('_dragData', null);
    this.set('_dragScope', null);
  }
});
