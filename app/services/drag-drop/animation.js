import Ember from 'ember';
import { findDragDropElements } from 'drag-drop/components/drag-drop/item';

const animateFnGenerator = function(animationOptions = {}) {
  animationOptions = Ember.$.extend({}, {
    duration: 'fast'
  }, animationOptions);

  function animateDrag($scope, previousItemKeys, currentItemKeys) {
    $scope = $scope || Ember.$('body');

    // for the nice helper methods, make these Ember arrays
    previousItemKeys = Ember.makeArray(previousItemKeys);
    currentItemKeys = Ember.makeArray(currentItemKeys);

    return new Ember.RSVP.Promise(resolve => {
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
        if (Ember.Test) {
          Ember.Test.registerWaiter(() => isDone);
        }

        _executeAnimations(animations, () => {
          _afterAnimating(elements);
          resolve();
          isDone = true;
        });
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
        // for some reason it has to be added here, not in the CSS for .drag-drop--during-animation
        // TODO(kapil) do this part: touch events and keyboard events are disabled by setting enableTouch=false and enableKeyboard=false
        // while animations are happening
        pointerEvents: 'none',
        touchAction: 'none'
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
        touchAction: '',
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
      duration: animationOptions.duration,
      complete: afterCompleteFn
    });
  }

  return animateDrag;
};

export default Ember.Service.extend({
  animate($scope, previousItemKeys, currentItemKeys, animationOptions) {
    return animateFnGenerator(animationOptions)(
      $scope, previousItemKeys, currentItemKeys
    );
  }
});
