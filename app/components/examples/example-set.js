import Ember from 'ember';

function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

export default Ember.Component.extend({
  title: 'Single Set Example',
  containerClass: null,
  dragScope: null,
  dropScope: null,
  enableDragHandle: true,
  resetAfterDropOutside: true,
  resetAfterDragCancel: true,
  enableAnimation: true,
  enableTouch: true,
  enableKeyboard: true,
  animationDurationInput: 'fast',

  componentName: Ember.computed('useSwap', function() {
    return this.get('useSwap') ? 'drag-drop/swap-set' : 'drag-drop/insertion-set';
  }),

  itemDragHandleSelector: Ember.computed('enableDragHandle', function() {
    return this.get('enableDragHandle') ? '.title' : null;
  }),

  animationDuration: Ember.computed('animationDurationInput', function() {
    const input = this.get('animationDurationInput');
    const num = +input;

    if (isNaN(num)) {
      return input || 'fast';
    } else {
      return num;
    }
  }),

  containerSelector: Ember.computed('containerClass', function() {
    return `.${this.get('containerClass')}`;
  }),

  init(...args) {
    this._super(...args);

    this.set('containerClass', this.get('name'));

    this.set('nextKey', 'a');
    this.set('items', [
      this._createItem(this._advanceItemKey()),
      this._createItem(this._advanceItemKey()),
      this._createItem(this._advanceItemKey()),
      this._createItem(this._advanceItemKey()),
      this._createItem(this._advanceItemKey())
    ]);
  },

  actions: {
    createItemFirst() {
      const newItem = this._createItem(this._advanceItemKey());
      this.get('items').insertAt(0, newItem);
    },

    createItemLast() {
      const newItem = this._createItem(this._advanceItemKey());
      const len = this.get('items.length') || 0;
      this.get('items').insertAt(len, newItem);
    }
  },

  _advanceItemKey() {
    const key = this.get('nextKey');
    this.set('nextKey', nextChar(key));
    return key;
  },

  _createItem(key) {
    return {
      key,
      title: `Item ${key}`,
      dnd: {
        enableDragging: true,
        enableDropping: true
      }
    };
  }
});
