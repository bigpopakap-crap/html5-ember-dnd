import Ember from 'ember';

export default Ember.Component.extend({
  setTransferService: Ember.inject.service('drag-drop/set-transfer'),
  animationService: Ember.inject.service('drag-drop/animation'),

  // PASSED IN
  parentSelector: 'body', // a CSS selector to the parent element, or something
  												// that will uniquely scope this component on the page
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
  _droppedItemKey: null, // keeps track of the last item that was dragged over
  										   // during the course of a drag
  _dragCancelled: null,
  _dropSucceeded: null, // indicates whether the drop actually ended on an item
  											// or outside the set of items (in case we need to revert)

  tagName: '',

  // TODO(kapil) animate elements when they're added or removed
  // and provide params to dictate what kind of animation to use

  actions: {
    onDragStart({ dragData: draggedItemKey }) {
      // remember which widget we are currently dragging
      this._originalItems = this.get('items').slice();
      this._dropSucceeded = false;
      this._dragCancelled = false;

      this.get('setTransferService').setData({
        setComponent: this,
        draggedItem: this._getItemByKey(draggedItemKey)
      });
    },

    onDragEnter({ dropData: dropItemKey }) {
      // Transfer the item into this set from its source
      this.get('setTransferService').transfer({
        targetSet: this,
        targetItemKey: dropItemKey
      });
    },

    onDragOver({ dragData: draggedItemKey, dropData: dropItemKey }) {
      const sourceSet = this.get('setTransferService.sourceSet');

      // Note: most of the time, sourceSet==this should be true because of the
      // transfer in the dragEnter event. But this is here as a defensive protection.
      // If this check fails, it's most likely because something from outside the browser
      // tab was dragged here
      if (sourceSet === this) {
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
      // Note 2: most of the time, sourceSet==this should be true because of the
      // transfer in the dragEnter event. But this is here as a defensive protection
      const sourceSet = this.get('setTransferService.sourceSet');
      if (sourceSet === this) {
        this._dropSucceeded = true;
      }
    },

    onDragCancel() {
      this._dragCancelled = true;
    },

    onDragEnd({ dragData: draggedItemKey }) {
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

      this.get('setTransferService').clearData();
    }
  },

  /* BEGIN SET TRANSFER FUNCTIONS ***********/
  removeItemForTransfer({ itemKeyToRemove }) {
    this._removeItem(itemKeyToRemove);

    this.sendAction('afterDragOut', {
      draggedItemKey: itemKeyToRemove
    });
  },

  insertItemForTransfer({ dragOverItemKey, itemKeyToAdd, itemToAdd }) {
    this._insertItem(dragOverItemKey, itemToAdd);

    this.sendAction('afterDragIn', {
      draggedItemKey: itemKeyToAdd,
      dropItemKey: dragOverItemKey
    });
  },

  /* BEGIN OVERRIDABLE FUNCTIONS ************/
  _sortItems(draggedItemKey, dropItemKey) {
    this.sendAction('sortRequested', {
      draggedItemKey,
      dropItemKey
    });
  },

  _removeItem(itemKeyToRemove) {
    this.sendAction('removalRequested', itemKeyToRemove);
  },

  _insertItem(dragOverItemKey, itemToAdd) {
    this.sendAction('insertionRequested', dragOverItemKey, itemToAdd);
  },

  /* BEGIN HELPERS **************************/
  _getItemByKey(itemSortKey) {
    const items = this.get('items');
    return items.findBy('sortKey', itemSortKey);
  },

  _getItemIndexByKey(itemSortKey) {
    const items = this.get('items');
    const item = this._getItemByKey(itemSortKey);
    return items.indexOf(item);
  },

  _getItemKeys() {
    return this.get('items').mapBy('sortKey');
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
    this.get('animationService').animate(
      $scope,
      previousItemKeys,
      currentItemKeys,
      {
        duration: this.get('animationDuration')
      }
    ).then(() => {
      this.set('isAnimating', false);
    });
  }
}).reopenClass({
  positionalParams: ['items']
});
