import Ember from 'ember';

function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

export default Ember.Component.extend({
  title: 'Generic Set Example',
  componentName: null,
  containerClass: null,

  enableSorting: true,
  resetAfterDropOutside: true,
  resetAfterDragCancel: true,
  enableAnimation: true,
  enableTouch: true,
  enableKeyboard: true,
  animationDurationInput: 'fast',

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

    this.set('items', [
      { key: 'A', text: 'Item A', subtext: 'blah blah blah blah' },
      { key: 'b', text: 'Item B', subtext: 'shmooop bloop' },
      { key: 'c', text: 'Item C', subtext: 'yaddah yaddah yaddah' },
      { key: 'd', text: 'Item D', subtext: 'lorem ipsum whatever' },
      { key: 'e', text: 'Item E', subtext: 'meeeeehhhhhhhhhhhh' },
      { key: 'f', text: 'Item F', subtext: '......' }
    ]);

    this.set('nextKey', 'g');
  },

  actions: {
    createItemFirst() {
      const newItem = this._createItem();
      this.get('items').insertAt(0, newItem);
    },

    createItemLast() {
      const newItem = this._createItem();
      const len = this.get('items.length') || 0;
      this.get('items').insertAt(len, newItem);
    }
  },

  _createItem() {
    const nextKey = this.get('nextKey');
    this.set('nextKey', nextChar(nextKey));
    return {
      key: nextKey,
      text: `Item ${nextKey}`,
      subtext: this.get('newItemText')
    };
  }
});
