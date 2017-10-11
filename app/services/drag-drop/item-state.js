import Ember from 'ember';

export default Ember.Service.extend({
  _itemStateRegistry: Ember.Object.create(),

  forItem(dragData) {
    let itemState = this.get(`_itemStateRegistry.${dragData}`);
    if (!itemState) {
      itemState = Ember.Object.create();
      this.set(`_itemStateRegistry.${dragData}`, itemState);
    }
    return itemState;
  }
});
