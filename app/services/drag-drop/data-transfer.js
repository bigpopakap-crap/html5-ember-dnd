import Ember from 'ember';

export default Ember.Service.extend({
  dragData: null,        // the "data" attribute of the item being dragged
  dragScopeArray: null,  // the "dragScope" of of the item being dragged

  setData({ dragData, dragScopeArray }) {
    this.set('dragData', dragData);
    this.set('dragScopeArray', dragScopeArray);
  },

  getData() {
    return {
      dragData: this.get('dragData'),
      dragScopeArray: this.get('dragScopeArray')
    };
  },

  clearData() {
    this.set('dragData', null);
    this.set('dragScopeArray', null);
  }
});
