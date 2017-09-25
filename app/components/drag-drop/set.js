import Ember from 'ember';
import { findDragDropElements } from './item';

const DragDropSortableListItem = Ember.ObjectProxy.extend({
  sortKey: Ember.computed('sortKeyProperty', function() {
    return this.get(this.get('sortKeyProperty'));
  })
});

const animateDrag = (function() {
  function animateDrag($scope, previousItemKeys, currentItemKeys) {
    // for the nice helper methods, make these Ember arrays
    previousItemKeys = Ember.makeArray(previousItemKeys);
    currentItemKeys = Ember.makeArray(currentItemKeys);

    // Use 'afterRender' because that's when 3rd party DOM-manipulation
    // libraries should execute
    // See https://guides.emberjs.com/v1.10.0/understanding-ember/run-loop/#toc_what-happens-in-these-queues
    Ember.run.scheduleOnce('afterRender', () => {
      const elements = findDragDropElements($scope);

      // We have to calculate where everything will move before starting the
      // animation, or else things will be moving while we're trying to determine
      // their position
      const animations = _getAnimations(elements, previousItemKeys, currentItemKeys);

      _beforeAnimating(elements, animations);

      // Register an internal waiter when in testing, so we can wait for the animation to be done
      let isDone = false;
      Ember.Test && Ember.Test.registerWaiter(() => isDone);
      // start an async run loop so that we can queue up the
      // post-animation callback when all the animations are over
      _executeAnimations(animations, () => {
        _afterAnimating(elements);
        isDone = true;
      });
    });
  }

  /* BEGIN HELPERS **************************/

  /**
   * Given the old order of the array and the new order, figures out
   * where each item moved to
   *
   * Each element in the returned array will look like:
   * {
   *     $itemToAnimate,    // JQuery element to animate
   *     initialProperties, // The first wave of positioning: the set of CSS properties
   *                        // to apply to the element before we do the animation
   *     finalProperties    // The second wave of positioning: The set of properties
   *                        // to apply to the element with an animation
   * }
   *
   * @param {any} elements
   * @param {any} previousItemKeys the previous sort order (just the keys)
   * @param {any} currentItemKeys the current sort order (just they keys)
   * @returns {Array<any>}
   */
  function _getAnimations(elements, previousItemKeys, currentItemKeys) {
    const animations = [];

    // make a unique union of the two lists in case some elements were
    // removed or added
    const allItemKeys = previousItemKeys.concat(currentItemKeys).uniq();

    allItemKeys.forEach(curItemKey => {
      // TODO(kapil) check here if the curItemKey no longer exists (curItemKey was deleted)
      const $curItem = elements.byData(curItemKey);

      const previousIndex = previousItemKeys.indexOf(curItemKey);
      // TODO(kapil) check here if the previousIndex is -1 ($curItem was added)
      const currentItemKeyAtPreviousIndex = currentItemKeys[previousIndex];
      if (currentItemKeyAtPreviousIndex === curItemKey) {
        // this item hasn't moved
        return;
      }
      const $oldPosition = elements.byData(currentItemKeyAtPreviousIndex);

      const { topDelta, leftDelta } = _calculateDelta($curItem, $oldPosition);

      animations.push({
        $itemToAnimate: $curItem,
        initialProperties: {
          top: `${topDelta}px`,
          left: `${leftDelta}px`
        },
        finalProperties: {
          top: '',
          left: ''
        }
      });
    });

    return animations;
  }

  function _calculateDelta($itemToMove, $destinationItem) {
    const dragElemPosition = $itemToMove.position();
    const dropElemPosition = $destinationItem.position();

    const dragElemMarginTop = parseInt($itemToMove.css('marginTop'));
    const dragElemMarginLeft = parseInt($itemToMove.css('marginLeft'));
    const dropElemMarginTop = parseInt($destinationItem.css('marginTop'));
    const dropElemMarginLeft = parseInt($destinationItem.css('marginLeft'));

    const topDelta = dropElemPosition.top + dropElemMarginTop - dragElemPosition.top - dragElemMarginTop;
    const leftDelta = dropElemPosition.left + dropElemMarginLeft - dragElemPosition.left - dragElemMarginLeft;

    return { topDelta, leftDelta };
  }

  function _beforeAnimating(elements, animations) {
    elements
      .all()
      .css({
        // temporarily disable drag drop while the widgets are animating
        pointerEvents: 'none'
      })
      .addClass('drag-drop--during-animation')
      .stop(true, true); // finish any in-progress animations

    animations.forEach(({ $itemToAnimate }) => {
      $itemToAnimate.addClass('drag-drop--animating');
    });
  }

  function _afterAnimating(elements) {
    elements
      .all()
      .css({
        pointerEvents: '',
        top: '',
        left: ''
      })
      .removeClass('drag-drop--animating drag-drop--during-animation');
  }

  function _executeAnimations(animations, afterCompleteFn) {
    // first handle the case that there are no animations to do.
    // this would be a weird case, but it's better not to kill the page
    // if it does happen
    if (Ember.isEmpty(animations)) {
      afterCompleteFn();
      return;
    }

    let numAnimationsLeft = animations.length;
    animations.forEach(animation => {
      _executeAnimation(animation, () => {
        numAnimationsLeft--;

        // wait for all animations to complete
        if (numAnimationsLeft === 0) {
          afterCompleteFn();
        }
      });
    });
  }

  function _executeAnimation(animation, afterCompleteFn) {
    const { $itemToAnimate, initialProperties, finalProperties } = animation;

    // first temporarily move the element back to its old position in the list
    $itemToAnimate.css(initialProperties);

    // then animate it back to its final resting place
    $itemToAnimate.animate(finalProperties, {
      duration: 'fast',
      complete: afterCompleteFn
    });
  }

  return animateDrag;
})();

export default Ember.Component.extend({
  // PASSED IN
  parentSelector: 'body', // a CSS selector to the parent element, or something
  												// that will uniquely scope this component on the page
  isSortable: false,
  itemSortKeyProperty: null,
  itemClass: null,
  itemDragHandleSelector: null, // a CSS selector for the child element where a
  															// drag can be initiated
  resetAfterDropOutside: false, // should we revert the order if the drop ends
  															// outside the list of items?
  shouldAnimate: false,
  shouldHandleTouch: true,

  // PRIVATE
  _originalItems: null, // the original list of items stored
  											// during a drag, in case we need to revert
  _currentDraggedItemKey: null, // track which item is being dragged
  _droppedItemKey: null, // keeps track of the last item that was dragged over
  										   // during the course of a drag
  _dropSucceeded: null, // indicates whether the drop actually ended on an item
  											// or outside the set of items (in case we need to revert)

  tagName: '',

  _sortableItems: Ember.computed('items.[]', 'itemSortKeyProperty', function() {
    return this.get('items')
      .map(item => DragDropSortableListItem.create({
      	content: item,
        sortKeyProperty: this.get('itemSortKeyProperty')
      }))
      .filter(sortableItem => !Ember.isNone(sortableItem.get('sortKey')));
  }),

  actions: {
    onDragStart({ dragData: draggedItemKey }) {
      // remember which widget we are currently dragging
      this.set('_currentDraggedItemKey', draggedItemKey);
      this._originalItems = this.get('items').slice();
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

          if (this.get('shouldAnimate')) {
            this._animate(previousItemKeys);
          }
        } else if (this._droppedItemKey === null) {
          // we do this in case an item is dropped on itself
          this._droppedItemKey = dropItemKey;
        }
      }
    },

    onDrop() {
      const draggedItemKey = this.get('_currentDraggedItemKey');

      // protects against drags from outside the browser tab
      // Note: unlike the dragOver event, here we don't care about checking whether an element
      // is dragged over itself because that is actually expected. By the time we
      // get to onDrop, the element order has already changed and the dragged element
      // is actually being dropped on itself
      if (draggedItemKey) {
        this._dropSucceeded = true;

        // no need to sort because the array has already been updated
        this.sendAction('afterDrop', {
          draggedItemKey,
          dropItemKey: this._droppedItemKey // use the saved dropItem key because otherwise,
                                            // it will look like we're dropping the item on itself
        });
      }
    },

    onDragEnd() {
      if (this.get('resetAfterDropOutside') && !this._dropSucceeded) {
        const previousItemKeys = this._getItemKeys();
        this.set('items', this._originalItems);

        if (this.get('shouldAnimate')) {
          this._animate(previousItemKeys);
        }
      }

      // forget all the state we were tracking
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

  _sortItems(dragKey, dropKey) {
    const dragIndex = this._getItemIndexByKey(dragKey);
    const dropIndex = this._getItemIndexByKey(dropKey);

    // Use Ember's special mutation functions so the property
    // is updated and the template re-renders
    // See http://emberjs.com/api/classes/Ember.MutableArray.html
    const items = this.get('items');
    const draggedItem = items[dragIndex];
    items.removeAt(dragIndex, 1);
    items.replace(dropIndex, 0, [draggedItem]);
  },

  _animate(previousItemKeys) {
    const $scope = Ember.$(this.get('parentSelector'));
    const currentItemKeys = this._getItemKeys();
    animateDrag($scope, previousItemKeys, currentItemKeys);
  }
}).reopenClass({
  positionalParams: ['items']
});
