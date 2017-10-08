import Ember from 'ember';

const KEY_CODES = {
  ESC: 27,
  ENTER: 13,
  SPACE: 32,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40
};

const KEY_DRAG_DIRECTION = {
  UP:     { name: 'up',    minDim: 'height', dx:  0, dy: -1, perpDx: -1, perpDy:  0 },
  RIGHT:  { name: 'right', minDim: 'width',  dx:  1, dy:  0, perpDx:  0, perpDy:  1 },
  DOWN:   { name: 'down',  minDim: 'height', dx:  0, dy:  1, perpDx:  1, perpDy:  0 },
  LEFT:   { name: 'left',  minDim: 'width',  dx: -1, dy:  0, perpDx:  0, perpDy: -1 }
};

export function findDragDropElements($scope) {
  $scope = $scope || Ember.$('body');
  const $elems = $scope.find('.drag-drop');

  return {
    all() {
      return $elems;
    },

    byData(data) {
      return $elems.filter(`[data-drag-drop-data="${data}"]`);
    }
  };
}

function dotP(x, y, a, b) {
  return x*a + y*b;
}

function makeArray(maybeArray) {
  if (!maybeArray) {
    return null;
  } else if (Ember.isArray(maybeArray)) {
    return maybeArray;
  } else if (typeof maybeArray === 'string') {
    return Ember.makeArray(maybeArray.split(','));
  } else {
    return Ember.makeArray(maybeArray);
  }
}

export default Ember.Component.extend({
  dataTransferService: Ember.inject.service('drag-drop/data-transfer'),

  // PASSED IN
  data: '', // REQUIRED - a string to pass along with the element
  // If two elements' scopes don't match, they will each behave as if the other doesn't
  // exist. If you want them to interact with each other but sometimes block
  // a dragOver or drop from occurring, you'll need to do that yourself in the
  // "sortRequested" handler
  dragScope: null, // An array or comma-separated list that determines where this item can be dragged.
                   // It can be dragged onto any element whose dropScope shares at least one keyword
                   // null or empty string means it cannot be dragged anywhere
  dropScope: null, // Array or comma-separated list. See dragScope for more info
                   // null or empty string means nothing can be dragged onto this
  enableDragging: false, // use this flag to turn on/off dragging behavior
  enableDropping: false, // use this flag to enable/disable this element as a drop target
  dragHandleSelector: null, // (optional) a CSS selector of the part of this element from
 														// where a drag can be initiated
  enableTouch: true,
  enableKeyboard: true,
  tabIndex: 0,

  // SHOULD PROBABLY BE PRIVATE
  dragEffectAllowed: 'all', // HTML5 drag property that tells the drop area which kinds of actions
  													// are supported by this draggable element when it is dropped
  dropEffect: 'move', // HTML5 drop property that indicates what kind of action will occur
  										// when an element is dropped on this element

  // PRIVATE
  isMouseDown: false,
  isSpaceKeyTyped: false,
  isHovered: false, // can't use :hover because of a webkit bug with :hover being overly persistent
 										// with drag and drop: http://stackoverflow.com/questions/17946886/hover-sticks-to-element-on-drag-and-drop
  isDragging: false,
  isDraggingByKey: false,
  isDraggedOver: false,
  dragTarget: null, // the target element of the drag (which part of the element the mouse is on)
  $dragOverElem: null, // used for touch dragging, it's the element we are currently dragging over
  $dragGhost: null, // the JQuery element that we are moving around with the drag
  									// we do this because HTML5 drag and drop doesn't do a good job with that

  isPressed: Ember.computed.and('isMouseDown'),
  isGrabbedByMouse: Ember.computed.and('enableDragging', 'isMouseDown', 'isDragHandlePressed'),
  isGrabbedByKey: Ember.computed.and('enableDragging', 'isSpaceKeyTyped', 'isFocused'),
  isGrabbed: Ember.computed.or('isGrabbedByMouse', 'isGrabbedByKey'),

  // Don't apply the CSS for dragging if we're dragging using the keyboard
  notIsDraggingByKey: Ember.computed.not('isDraggingByKey'),
  isStyledAsDragging: Ember.computed.and('isDragging', 'notIsDraggingByKey'),

  // TODO(kapil) this observer fires too many events. Need a better way to do this
//  isGrabChanged: Ember.observer('isGrabbed', function() {
//    if (this.get('isGrabbed')) {
//      this.sendAction('afterGrab', this.get('data'));
//    } else {
//      this.sendAction('afterRelease', this.get('data'));
//    }
//  }),

  beReadyForDrop: Ember.computed('dataTransferService.dragScopeArray', function() {
    return this._scopesMatch(
      this.get('dataTransferService.dragScopeArray'),
      this.get('dropScopeArray')
    );
  }),

  ariaGrabbed: Ember.computed('enableDragging', 'enableKeyboard', 'isGrabbed', function() {
    return this.get('enableDragging') && this.get('enableKeyboard')
              ? `${this.get('isGrabbed')}`
              : null;
  }),
  ariaDropEffect: Ember.computed('enableDropping', 'enableKeyboard', 'beReadyForDrop', 'dropEffect', function() {
    return this.get('enableDropping') && this.get('enableKeyboard') && this.get('beReadyForDrop')
              ? this.get('dropEffect')
              : null;
  }),

  notIsDragHandlePressed: Ember.computed.not('isDragHandlePressed'),
  isDragHandlePressed: Ember.computed('dragHandleSelector', 'dragTarget', function() {
    const dragHandleSelector = this.get('dragHandleSelector');
    if (!dragHandleSelector) {
      return true; // we don't care where the drag was initiated
    }

    // make sure the drag was initiated by the specified drag handle
    const dragTarget = this.get('dragTarget');
    return Ember.$(dragTarget).is(dragHandleSelector);
  }),

  dragScopeArray: Ember.computed('dragScope', function() {
    return makeArray(this.get('dragScope'));
  }),
  dropScopeArray: Ember.computed('dropScope', function() {
    return makeArray(this.get('dropScope'));
  }),

  classNames: ['drag-drop'],
  classNameBindings: [
    'beReadyForDrop:drag-drop--ready',
    'isFocused:drag-drop--focused',
    'isHovered:drag-drop--hovered',
    'isPressed:drag-drop--pressed',
    'isGrabbed:drag-drop--grabbed',
    'enableDragging:drag-drop--draggable',
    'isStyledAsDragging:drag-drop--dragging',
    'enableDropping:drag-drop--droppable',
    'isDraggedOver:drag-drop--dragged-over'
  ],

  attributeBindings: [
    'data:data-drag-drop-data',
    'dragScopeArray:data-drop-drop-drag-scope',
    'dropScopeArray:data-drop-drop-drop-scope',
    'tabIndex:tabindex',
    'ariaGrabbed:aria-grabbed',
    'ariaDropEffect:aria-dropeffect'
  ],

  actions: {
    /* BEGIN REGULAR MOUSE EVENTS *******************/
    mouseEnter() {
      this.set('isHovered', true);
    },

    mouseDown(evt) {
      this.set('isHovered', false);
      this.set('isMouseDown', true);
      this.set('dragTarget', evt.target);
    },

    mouseUp() {
      this.set('isHovered', true);
      this.set('isMouseDown', false);
      this.set('dragTarget', null);
    },

    mouseLeave() {
      // Technically, while dragging something, the mouse leaves itself
      // because we're only dragging a ghost. We don't want to pretend
      // that the dragged item is not hovered/grabbed, so we don't
      // erase these flags unless the item is not being dragged
      if (!this.get('isDragging')) {
        this.set('isHovered', false);
        this.set('isMouseDown', false);
        this.set('dragTarget', null);
      }
    },

    /* BEGIN DRAGGABLE EVENTS *******************/
    dragStart(evt) {
      if (!this.get('enableDragging') || !this.get('isGrabbed')) {
        return false;
      }

      const eventData = this._eventData(evt, {
        dragData: this.get('data')
      });

      // Doing this causes the dragging element to hide, which causes
      // problems when done in the dragStart handler. So we'll just queue
      // it up for the next run loop
      Ember.run.next(() => this.set('isDragging', true));

      const $dragGhost = this._createDragGhost(eventData);

      this.get('dataTransferService').setData({
        dragData: this.get('data'),
        dragScopeArray: this.get('dragScopeArray')
      });

      // If we're doing regular HTML5 drag and drop (not touch or keyboard),
      // then do the HTML5 stuff
      if (evt.dataTransfer) {
        evt.dataTransfer.effectAllowed = this.get('dragEffectAllowed');
        if (evt.dataTransfer.setDragImage) {
          // IE/Edge don't support this
          // We do this because HTML5's default ghost image isn't great
          // Ex. if the element is half off the screen, the drag image
          // will be cut off unless we override it like this
          evt.dataTransfer.setDragImage($dragGhost[0], eventData.offsetX, eventData.offsetY);
        }
      }

      this.sendAction('onDragStart', eventData);
      return true;
    },

    drag(evt) {
      // don't check enableDragging because clearly we've already allowed
      // a drag to start on this element

      const eventData = this._eventData(evt, {
        dragData: this.get('data')
      });

      this.sendAction('onDrag', eventData);
    },

    dragEnd(evt) {
      // don't check enableDragging because clearly we've already allowed
      // a drag to start on this element

      this.get('dataTransferService').clearData();
      this._clearDragGhost();

      // We have to do this this in next() because we set
      // isDragging to true in a next(). If we didn't do this,
      // then the two operations may run in the wrong order
      Ember.run.next(() => this.set('isDragging', false));

      // Make sure that this item is not longer considered "grabbed"
      this.send('mouseUp');

      this.sendAction(
        'onDragEnd',
        this._eventData(evt, {
          dragData: this.get('data')
        })
      );

      // Make sure we focus this thing afterwards
      Ember.run.scheduleOnce('afterRender', () => this.$().trigger('focus'));
    }
  },

  /* BEGIN DROP TARGET EVENTS *******************/
  /*
    Note: these only work if put on the whole component, not just the
    drag-drop__drag-content div
   */
  dragEnter(evt) {
    const { dragData, dragScopeArray } = this.get('dataTransferService').getData();
    const scopesMatch = this._scopesMatch(dragScopeArray, this.get('dropScopeArray'));

    if (this.get('enableDropping') && scopesMatch) {
      // TODO(kapil) don't set this to true if an item is dragging over itself
      this.set('isDraggedOver', true);

      // If we're doing HTML5 drag and drop, then do all the fancy
      // HTML5 drag and drop stuff
      if (evt.dataTransfer) {
        evt.dataTransfer.dropEffect = this.get('dropEffect');
      }

      this.sendAction(
        'onDragEnter',
        this._eventData(evt, {
          // unfortunately HTML5 dnd doesn't let you know what is being dragged over this
          dropData: this.get('data')
        })
      );
    }

    // Need to do this or else the "drop" event won't fire
    // http://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome
    evt.preventDefault();
  },

  dragOver(evt) {
    // don't check enableDropping, and instead check "isDraggedOver"
    // because if "isDraggedOver" is true, then we've already let a drag
    // through so we should continue to let it through
    if (this.get('isDraggedOver')) {
      this.sendAction(
        'onDragOver',
        this._eventData(evt, {
          // unfortunately HTML5 dnd doesn't let you know what is being dragged over this
          dropData: this.get('data')
        })
      );
    }

    // Need to do this or else the "drop" event won't fire
    // http://stackoverflow.com/questions/21339924/drop-event-not-firing-in-chrome
    evt.preventDefault();
  },

  dragLeave(evt) {
    // don't check enableDropping, and instead check "isDraggedOver"
    // because if "isDraggedOver" is true, then we've already let a drag
    // through so we should continue to let it through
    if (this.get('isDraggedOver')) {
      this.set('isDraggedOver', false);

      this.sendAction(
        'onDragLeave',
        this._eventData(evt, {
          // unfortunately HTML5 dnd doesn't let you know what is being dragged over this
          dropData: this.get('data')
        })
      );
    }
  },

  drop(evt) {
    const { dragData } = this.get('dataTransferService').getData();
    const isOverSelf = this.get('data') === dragData;

    // don't check enableDropping, and instead check "isDraggedOver"
    // because if "isDraggedOver" is true, then we've already let a drag
    // through so we should continue to let it through
    if (isOverSelf || this.get('isDraggedOver')) {
      this.set('isDraggedOver', false);

      evt = this._maybeOriginalEvent(evt);

      this.sendAction(
        'onDrop',
        this._eventData(evt, {
          dragData,
          dropData: this.get('data')
        })
      );
    }

    evt.preventDefault();
  },

  /* BEGIN TOUCH EVENTS **************/
  touchStart(evt) {
    if (!this.get('enableDragging') || !this.get('enableTouch')) {
      return false;
    }

    this.send('mouseEnter');
    this.send('mouseDown', evt);

    /*
     * BEGIN TOUCH HACKS
     * Remember where on this element (the "offset") the touch was
     * so that we can accurately position the ghost later
     */
    const touch = this._maybeTouchEvent(evt);
    const thisOffset = this.$().offset();

    this.set('_touchOffsetX', touch.pageX - thisOffset.left);
    this.set('_touchOffsetY', touch.pageY - thisOffset.top);

    return true;
  },

  touchMove(evt) {
    evt = this._maybeOriginalEvent(evt);
    const touch = this._maybeTouchEvent(evt);
    if (touch === evt) {
      // there's something weird going on with this event, because
      // touch should now be different than evt
      return false;
    }

    if (!this.get('isDragging')) {
      this.send('dragStart', evt);
    }
    if (!this.get('isDragging')) {
      // something failed in the drag start, so we shouldn't continue dragging
      return false;
    }

    this.send('drag', evt);

    /*
     * BEGIN TOUCH HACKS
     * Simulate the drop events (dragEnter dragOver dragLeave)
     * on elements that we are moving over
     */
    const $dragOverElem = this._getCurrentDragOverElem(touch.clientX, touch.clientY);
    const $prevDragOverElem = this.get('$dragOverElem');
    this.set('$dragOverElem', $dragOverElem);

    // simulate the drop events on the elements we are currently
    // and were previously dragging over
    if (!$dragOverElem.is($prevDragOverElem)) {
      if ($prevDragOverElem) {
        Ember.run(() => $prevDragOverElem.trigger('dragleave'));
      }
      Ember.run(() => $dragOverElem.trigger('dragenter'));
    }
    Ember.run(() => $dragOverElem.trigger('dragover'));

    /*
     * (Not really a hack)
     * Move the drag ghost
     */
    this._moveDragGhost({
      clientX: touch.clientX,
      clientY: touch.clientY,
      offsetX: this.get('_touchOffsetX'),
      offsetY: this.get('_touchOffsetY')
    });

    return true;
  },

  touchEnd(evt) {
    /*
     * BEGIN TOUCH HACKS
     * Simulate the drop event on the element that we are moving over
     */
    // if we have actually started a drag, force recalculate everything
    // with a touchMove(), and then use the cached $dragOverElem
    if (this.get('isDragging')) {
      this.touchMove(evt);
      const $dragOverElem = this.get('$dragOverElem');
      if ($dragOverElem) {
        // HACK ALERT: set the dragItemData on the drop target element
        // using JQuery data since we cannot pass it any other way
        Ember.run(() => $dragOverElem.trigger('drop'));
      }
    }

    this.touchCancel(evt);
    return true;
  },

  touchCancel(evt) {
    this.set('_touchOffsetX', null);
    this.set('_touchOffsetY', null);
    this.set('$dragOverElem', null);

    if (this.get('isDragging')) {
      this.send('dragEnd', evt);
    }
    this.send('mouseUp', evt);
    this.send('mouseLeave');
    return true;
  },

  /* BEGIN KEYBOARD INPUT EVENTS *****/
  focusIn() {
    this.set('isFocused', true);
    this.set('isSpaceKeyTyped', false);

    // don't call mouseEnter() here even though we call mouseLeave() on focusOut()
    // because we don't actually want to pretend the mouse is there, we just want
    // to clean up when we unfocus this element
  },

  focusOut() {
    // TODO(kapil) if we're dragging when we lose focus, we need to
    // end the drag (not as explicit cancel, but as a premature end)

    this.set('isFocused', false);
    this.set('isSpaceKeyTyped', false);

    // call this here even even though we don't call mouseEnter() on focusIn()
    // because we just want this to do cleanup. In case someone clicks on an item
    // and then tabs out to another item
    this.send('mouseLeave');
  },

  // TODO(kapil) disable some keys if this is being dragged by touch or mouse
  keyDown(evt) {
    if (this.get('enableKeyboard')) {
      switch (evt.keyCode) {
        case KEY_CODES.ESC:
          if (this.get('isDragging')) {
            this._cancelDragByKey(evt);
          } else {
            this.set('isSpaceKeyTyped', false);
          }
          return false;

        case KEY_CODES.SPACE:
        case KEY_CODES.ENTER:
          if (this.get('isDragging')) {
            this._dropByKey(evt);
          } else if (this.get('enableDragging')) {
            this.toggleProperty('isSpaceKeyTyped');
          }
          return false;

        case KEY_CODES.LEFT:
          if (this.get('isGrabbed')) {
            this._dragByKey(evt, KEY_DRAG_DIRECTION.LEFT);
          } else {
            this._focusByKey(evt, KEY_DRAG_DIRECTION.LEFT);
          }
          return false;

        case KEY_CODES.UP:
          if (this.get('isGrabbed')) {
            this._dragByKey(evt, KEY_DRAG_DIRECTION.UP);
          } else {
            this._focusByKey(evt, KEY_DRAG_DIRECTION.UP);
          }
          return false;

        case KEY_CODES.RIGHT:
          if (this.get('isGrabbed')) {
            this._dragByKey(evt, KEY_DRAG_DIRECTION.RIGHT);
          } else {
            this._focusByKey(evt, KEY_DRAG_DIRECTION.RIGHT);
          }
          return false;

        case KEY_CODES.DOWN:
          if (this.get('isGrabbed')) {
            this._dragByKey(evt, KEY_DRAG_DIRECTION.DOWN);
          } else {
            this._focusByKey(evt, KEY_DRAG_DIRECTION.DOWN);
          }
          return false;

        default:
          //do nothing
      }
    }

    return true;
  },

  /* BEGIN HELPERS *******************/
  _createDragGhost() {
    // In case we already have a drag ghost, use that one
    // If you want to create a new drag ghost, call _clearDragGhost()
    // before calling this
    const $existingDragGhost = this.get('$dragGhost');
    if ($existingDragGhost) {
      return $existingDragGhost;
    }

    const $dragGhost = this.$('.drag-drop__drag-content')
      .clone()
      .addClass('drag-drop__drag-content--ghost')
      .addClass(this.get('class'))
      .css({
        // Create a clone with the right dimensions, hide it behind the drop area with z-index: -1
        // display:none the original element via CSS
        // we can't move it off screen or safari does not render it
        // we can't use display: none because then HTML5 dnd doesn't draw the correct preview
        // We use these hacks to make it "invisible"
        // See http://www.kryogenix.org/code/browser/custom-drag-image.html
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        'z-index': -1
      });

    this._attachDragGhost($dragGhost);

    this.set('$dragGhost', $dragGhost);
    return $dragGhost;
  },

  // TODO if we can get this to work, then maybe we should use it
  // even for regular drag and drop instead of the bad HTML5 ghost
  _moveDragGhost({ clientX, clientY, offsetX = 0, offsetY = 0 }) {
    const $dragGhost = this.get('$dragGhost');
    if ($dragGhost) {
      $dragGhost.css({
        position: 'fixed',
        top: `${clientY - offsetY}px`,
        left: `${clientX - offsetX}px`,
        width: '',
        height: '',
        'z-index': ''
      });
    }
  },

  _getCurrentDragOverElem(clientX, clientY) {
    const $dragGhost = this.get('$dragGhost');

    // makes sure the drag ghost isn't in our way
    if ($dragGhost) {
      $dragGhost.detach();
    }

    const $dragOverElem = Ember.$(document.elementFromPoint(
      clientX,
      clientY
    ));

    this._attachDragGhost($dragGhost);

    return $dragOverElem;
  },

  _attachDragGhost($dragGhost) {
    if ($dragGhost) {
      this.$().append($dragGhost);
    }
  },

  _clearDragGhost() {
    const $dragGhost = this.get('$dragGhost');
    if ($dragGhost) {
      $dragGhost.remove();
    }
    this.set('$dragGhost', null);
  },

  _maybeOriginalEvent(evt) {
    return (evt && evt.originalEvent) || evt;
  },

  _maybeTouchEvent(evt) {
    const orig = this._maybeOriginalEvent(evt);
    return (orig.touches && orig.touches[0])
        || (orig.changedTouches && orig.changedTouches[0])
        || orig;
  },

  _eventData(evt, extraParams) {
    const params = this._maybeTouchEvent(evt);

    return Ember.$.extend(
      true,
      {},
      {
        // mouse position relative to page
        pageX: params.pageX,
        pageY: params.pageY,

        // mouse position relative to target element
        // (which is the dragged element for drag events,
        // and the drop target element for drop events)
        offsetX: params.offsetX,
        offsetY: params.offsetY
      },
      extraParams
    );
  },

  _scopesMatch(dragScope, dropScope) {
    const dragScopeArray = makeArray(dragScope);
    const dropScopeArray = makeArray(dropScope);

    if (!dragScopeArray || !dropScopeArray) {
      // neither thing can be moved
      return true;
    } else {
      let foundMatch = false;

      dragScopeArray.forEach(scope => {
        if (dropScopeArray.includes(scope)) {
          foundMatch = true;
        }
      });

      return foundMatch;
    }
  },

  _focusByKey(evt, direction) {
    const $sortedTargets = this._dragByKeyTargets(direction);
    const $target = $sortedTargets && $sortedTargets[0];
    if ($target) {
      Ember.run(() => $target.trigger('focus'));
    }
  },

  _dragByKey(evt, direction) {
    const $sortedTargets = this._dragByKeyTargets(direction);
    const $dragOverElem = $sortedTargets && $sortedTargets[0];
    if ($dragOverElem) {
      this.set('$dragOverElem', $dragOverElem);

      if (!this.get('isDragging')) {
        this.send('dragStart', evt);
        this.set('isDraggingByKey', true);
      }
      this.send('drag', evt);

      Ember.run(() => $dragOverElem.trigger('dragenter'));
      Ember.run(() => $dragOverElem.trigger('dragover'));

      // re-grab the element so that the user can continue dragging
      Ember.run(() => this.$().trigger('focus'));
      // don't call keyDown() to do this, or it will drop the item
      this.set('isSpaceKeyTyped', true);
    }
  },

  _dropByKey(evt) {
    const $dragOverElem = this.get('$dragOverElem');
    if ($dragOverElem) {
      Ember.run(() => $dragOverElem.trigger('drop'));
    }
    this._endDragByKey(evt);
  },

  _cancelDragByKey(evt) {
    this.sendAction('onDragCancel', this.get('data'));
    this._endDragByKey(evt);
  },

  _endDragByKey(evt) {
    this.send('dragEnd', evt);

    this.set('$dragOverElem', null);
    this.set('isSpaceKeyTyped', false);

    // Ember.run.next so that there "isDragging" is definitely false
    // before we set this to false
    Ember.run.next(() => this.set('isDraggingByKey', false));

    // for whatever reason, we need to put this in the "afterRender" queue
    Ember.run.scheduleOnce('afterRender', () => this.$().trigger('focus'));
  },

  _dragByKeyTargets(direction) {
    const $this = this.$();
    const thisPosition = $this.offset();
    const minDot = (() => {
      switch(direction.minDim) {
        case 'width':  return $this.outerWidth();
        case 'height': return $this.outerHeight();
        default: return 0;
      }
    })();

    const dragScopeArray = this.get('dragScopeArray');

    return findDragDropElements()
      .all()
      .toArray()
      .map(item => Ember.$(item))
      .filter($item => !$item.is($this))
      .filter($item => {
        if (!this.get('isGrabbed')) {
          // allow simply focusing any element
          return true;
        } else {
          // if we're dragging, only consider items whose dropScope matches our dragScope
          const dropScope = $item.attr('data-drop-drop-drop-scope');
          return this._scopesMatch(dragScopeArray, dropScope);
        }
      })
      .map($item => {
        const dx = $item.offset().left - thisPosition.left;
        const dy = $item.offset().top - thisPosition.top;

        const dotProd = dotP(direction.dx, direction.dy, dx, dy);
        const perpIndex = Math.abs(dotP(direction.perpDx, direction.perpDy, dx, dy));

        // TODO(kapil) should we allow wrapping around? Ex. if you're at the end of a row
        // and drag right, should you go to the next row?
        return { $item, dotProd, perpIndex };
      })
      .filter(({ dotProd }) => dotProd > minDot)
      .sortBy('dotProd', 'perpIndex')
      .map(({ $item }) => $item);
  }
});
