import Ember from 'ember';

export default Ember.Component.extend({
  enableSorting: true,
  resetAfterDropOutside: true,
  resetAfterDragCancel: true,
  enableAnimation: true,
  enableTouch: true,
  enableKeyboard: true,
  animationDuration: 'fast',

  items: [
    { key: 'A', text: 'Item A', subtext: 'blah blah blah blah' },
    { key: 'b', text: 'Item B', subtext: 'shmooop bloop' },
    { key: 'c', text: 'Item C', subtext: 'yaddah yaddah yaddah' },
    { key: 'd', text: 'Item D', subtext: 'lorem ipsum whatever' },
    { key: 'e', text: 'Item E', subtext: 'meeeeehhhhhhhhhhhh' },
    { key: 'f', text: 'Item F', subtext: '......' },
    { key: 'g', text: 'Item G', subtext: 'uhhhhh wutt?' },
    { key: 'h', text: 'Item H', subtext: 'ok now this is just getting annoying' },
    { key: 'i', text: 'Item I', subtext: 'NO U' },
    { key: 'j', text: 'Item J', subtext: 'I AM J, K' },
    { key: 'k', text: 'Item K!', subtext: 'i am kapil' }
  ]
});
