import Ember from 'ember';

export default Ember.Controller.extend({
  set1Name: 'set-1',
  set2Name: 'set-2',

  linkLists: false,
  onlyForward: false,

  set1DragScope: Ember.computed('set1Name', 'set2Name', 'linkLists', function() {
    const set1Name = this.get('set1Name');
    const set2Name = this.get('set2Name');
    const linkLists = this.get('linkLists');

    if (linkLists) {
      return `${set1Name},${set2Name}`;
    } else {
      return set1Name;
    }
  }),
  set1DropScope: Ember.computed('set1Name', 'set2Name', 'linkLists', 'onlyForward', function() {
    const set1Name = this.get('set1Name');
    const set2Name = this.get('set2Name');
    const linkLists = this.get('linkLists');
    const onlyForward = this.get('onlyForward');

    if (linkLists) {
      if (onlyForward) {
        return set1Name;
      } else {
        return `${set1Name},${set2Name}`;
      }
    } else {
      return set1Name;
    }
  }),

  set2DragScope: Ember.computed('set1Name', 'set2Name', 'linkLists', 'onlyForward', function() {
    const set1Name = this.get('set1Name');
    const set2Name = this.get('set2Name');
    const linkLists = this.get('linkLists');
    const onlyForward = this.get('onlyForward');

    if (linkLists) {
      if (onlyForward) {
        return set2Name;
      } else {
        return `${set1Name},${set2Name}`;
      }
    } else {
      return set2Name;
    }
  }),
  set2DropScope: Ember.computed('set1Name', 'set2Name', 'linkLists', function() {
    const set1Name = this.get('set1Name');
    const set2Name = this.get('set2Name');
    const linkLists = this.get('linkLists');

    if (linkLists) {
      return `${set1Name},${set2Name}`;
    } else {
      return set2Name;
    }
  }),
});
