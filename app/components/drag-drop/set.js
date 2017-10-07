import Ember from 'ember';

const DragDropSortableListItem = Ember.ObjectProxy.extend({
  sortKey: Ember.computed('sortKeyProperty', function() {
    return this.get(this.get('sortKeyProperty'));
  })
});

export default Ember.Component.extend({
  animationService: Ember.inject.service('drag-drop/animation'),

  // PASSED IN
  parentSelector: 'body', // a CSS selector to the parent element, or something
  												// that will uniquely scope this component on the page
  sortProperty: null,
  enableAnimation: false,
  enableTouch: true,
  enableKeyboard: true,
  animationDuration: 'fast',
  resetAfterDropOutside: false, // should we revert the order if the drop ends
  															// outside the list of items?
  resetAfterDragCancel: true,   // Reset the order if the user explicitly cancels the
                                // drag (ex. with the ESC key)

  // PRIVATE
  isAnimating: false,
  _originalItems: null, // the original list of items stored
  											// during a drag, in case we need to revert
  _currentDraggedItemKey: null, // track which item is being dragged
  _droppedItemKey: null, // keeps track of the last item that was dragged over
  										   // during the course of a drag
  _dragCancelled: null,
  _dropSucceeded: null, // indicates whether the drop actually ended on an item
  											// or outside the set of items (in case we need to revert)

  tagName: '',

  _sortableItems: Ember.computed('items.[]', 'sortProperty', function() {
    return this.get('items')
      .map(item => DragDropSortableListItem.create({
      	content: item,
        sortKeyProperty: this.get('sortProperty')
      }))
      .filter(sortableItem => !Ember.isNone(sortableItem.get('sortKey')));
  }),

  // TODO(kapil) animate elements when they're added or removed
  // and provide params to dictate what kind of animation to use

  actions: {
    onDragStart({ dragData: draggedItemKey }) {
      // remember which widget we are currently dragging
      this.set('_currentDraggedItemKey', draggedItemKey);
      this._originalItems = this.get('items').slice();
      this._dropSucceeded = false;
      this._dragCancelled = false;
    },

    onDragOver({ dropData: dropItemKey }) {
      const draggedItemKey = this.get('_currentDraggedItemKey');

      // protects against drags from outside the browser tab
      if (draggedItemKey) {
        // also against a million events when an element is dragged over itself
        if (draggedItemKey !== dropItemKey) {
          this._droppedItemKey = dropItemKey;

          const previousItemKeys = this._getItemKeys();
          this._sortItems(draggedItemKey, dropItemKey);
          this.sendAction('afterDragOver', { draggedItemKey, dropItemKey });

          if (this.get('enableAnimation')) {
            this._animate(previousItemKeys);
          }
        } else if (this._droppedItemKey === null) {
          // we do this in case an item is dropped on itself
          this._droppedItemKey = dropItemKey;
        }
      }
    },

    onDrop() {
      // protects against drags from outside the browser tab
      // Note: unlike the dragOver event, here we don't care about checking whether an element
      // is dragged over itself because that is actually expected. By the time we
      // get to onDrop, the element order has already changed and the dragged element
      // is actually being dropped on itself
      const draggedItemKey = this.get('_currentDraggedItemKey');
      if (draggedItemKey) {
        this._dropSucceeded = true;
      }
    },

    onDragCancel() {
      this._dragCancelled = true;
    },

    onDragEnd() {
      const draggedItemKey = this.get('_currentDraggedItemKey');

      // TODO(kapil) clean up this weird logic... it feels like we shouldn't
      // treat these two things differently
      const shouldResetOrder = (this.get('resetAfterDragCancel') && this._dragCancelled)
                            || (this.get('resetAfterDropOutside') && !this._dragCancelled && !this._dropSucceeded);
      if (shouldResetOrder) {
        this._resetOrder();
      }

      const eventName = this._dragCancelled ? 'afterCancel' : 'afterDrop';
      this.sendAction(eventName, {
        wasSuccessful: this._dragCancelled ? undefined : this._dropSucceeded,
        didResetOrder: shouldResetOrder,
        draggedItemKey,
        dropItemKey: this._droppedItemKey // use the saved dropItem key because otherwise,
                                          // it will look like we're dropping the item on itself
      });

      // forget all the state we were tracking
      this._dragCancelled = null;
      this._droppedItemKey = null;
      this._dropSucceeded = null;
      this._originalItems = null;
      this.set('_currentDraggedItemKey', null);
    }
  },

  /* BEGIN HELPERS **************************/
  _getItemIndexByKey(itemSortKey) {
    const sortableItems = this.get('_sortableItems');
    return sortableItems.indexOf(sortableItems.findBy('sortKey', itemSortKey));
  },

  _getItemKeys() {
    return this.get('_sortableItems').mapBy('sortKey');
  },

  _sortItems(draggedItemKey, dropItemKey) {
    this.sendAction('sortRequested', {
      draggedItemKey,
      dropItemKey
    });
  },

  _resetOrder() {
    const previousItemKeys = this._getItemKeys();
    this.set('items', this._originalItems);

    if (this.get('enableAnimation')) {
      this._animate(previousItemKeys);
    }
  },

  _animate(previousItemKeys) {
    const $scope = Ember.$(this.get('parentSelector'));
    const currentItemKeys = this._getItemKeys();

    this.set('isAnimating', true);
    this.get('animationService').animate($scope, previousItemKeys, currentItemKeys, {
      duration: this.get('animationDuration')
    }).then(() => {
      this.set('isAnimating', false);
    });
  }
}).reopenClass({
  positionalParams: ['items']
});
