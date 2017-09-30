import Ember from 'ember';

const KEY_DRAG_DIRECTION = {
  UP:     { dx:  0, dy: -1 },
  RIGHT:  { dx:  1, dy:  0 },
  DOWN:   { dx:  0, dy:  1 },
  LEFT:   { dx: -1, dy:  0 }
};

export function findDragDropElements($scope) {
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

// IE11 and Edge only support "text"
const DATA_TRANSFER_TYPE = 'text';
const TOUCH_DATA_TRANSFER_KEY = 'dragDrop_component_dragData';

export default Ember.Component.extend({
  // PASSED IN
  data: '', // REQUIRED - a string to pass along with the element
  enableDragging: false, // use this flag to turn on/off dragging behavior
  enableDropping: false, // use this flag to enable/disable this element as a drop target
  dragHandleSelector: null, // (optional) a CSS selector of the part of this element from
 														// where a drag can be initiated
  enableTouch: true,
  enableKeyboard: true,
  beReadyForDrop: false, // flag to indicate that some item is being dragged that might be
                         // dropped onto this item
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
  isDraggedOver: false,
  dragTarget: null, // the target element of the drag (which part of the element the mouse is on)
  $dragOverElem: null, // used for touch dragging, it's the element we are currently dragging over
  $dragGhost: null, // the JQuery element that we are moving around with the drag
  									// we do this because HTML5 drag and drop doesn't do a good job with that

  isPressed: Ember.computed.and('isMouseDown', 'notIsDragHandlePressed'),
  isGrabbedByMouse: Ember.computed.and('isMouseDown', 'isDragHandlePressed'),
  isGrabbedByKey: Ember.computed.and('isSpaceKeyTyped', 'isFocused'),
  isGrabbed: Ember.computed.or('isGrabbedByMouse', 'isGrabbedByKey'),

  isGrabChanged: Ember.observer('isGrabbed', function() {
    if (this.get('isGrabbed')) {
      this.sendAction('afterGrab', this.get('data'));
    } else {
      this.sendAction('afterRelease', this.get('data'));
    }
  }),

  ariaGrabbed: Ember.computed('enableKeyboard', 'isGrabbed', function() {
    return this.get('enableKeyboard')
              ? `${this.get('isGrabbed')}`
              : null;
  }),
  ariaDropEffect: Ember.computed('enableKeyboard', 'beReadyForDrop', 'dropEffect', function() {
    return this.get('enableKeyboard') && this.get('beReadyForDrop')
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

  classNames: ['drag-drop'],
  classNameBindings: [
    'beReadyForDrop:drag-drop--ready',
    'isFocused:drag-drop--focused',
    'isHovered:drag-drop--hovered',
    'isPressed:drag-drop--pressed',
    'isGrabbed:drag-drop--grabbed',
    'enableDragging:drag-drop--draggable',
    'isDragging:drag-drop--dragging',
    'enableDropping:drag-drop--droppable',
    'isDraggedOver:drag-drop--dragged-over'
  ],

  attributeBindings: [
    'data:data-drag-drop-data',
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
      this.set('isHovered', false);
      this.set('isMouseDown', false);
      this.set('dragTarget', null);
    },

    /* BEGIN DRAGGABLE EVENTS *******************/
    dragStart(evt) {
      if (!this.get('isGrabbed')) {
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

      // Touch events don't have dataTransfer
      if (evt.dataTransfer) {
        evt.dataTransfer.setData(DATA_TRANSFER_TYPE, this.get('data'));
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
      const eventData = this._eventData(evt, {
        dragData: this.get('data')
      });

      this.sendAction('onDrag', eventData);
    },

    dragEnd(evt) {
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
    }
  },

  /* BEGIN DROP TARGET EVENTS *******************/
  /*
    Note: these only work if put on the whole component, not just the
    drag-drop__drag-content div
   */
  dragEnter(evt) {
    if (this.get('enableDropping')) {
      this.set('isDraggedOver', true);

      // Touch events don't have dataTransfer
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
    if (this.get('enableDropping')) {
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
    if (this.get('enableDropping')) {
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
    if (this.get('enableDropping')) {
      evt = this._maybeOriginalEvent(evt);

      this.set('isDraggedOver', false);

      // Touch events don't have dataTransfer, so we
      // have to fall back on our simulated event hack
      const dragData = evt.dataTransfer
        ? evt.dataTransfer.getData(DATA_TRANSFER_TYPE)
        : $(evt.target).data(TOUCH_DATA_TRANSFER_KEY);

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
    if (!this.get('enableTouch')) {
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
    if (!this.get('enableTouch')) {
      return false;
    }

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
        $prevDragOverElem.trigger('dragleave');
      }
      $dragOverElem.trigger('dragenter');
    }
    $dragOverElem.trigger('dragover');

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
    if (!this.get('enableTouch')) {
      return false;
    }

    /*
     * BEGIN TOUCH HACKS
     * Simulate the drop event on the element that we are moving over
     */
    // force recalculate everything with a touchMove(), and then use the cached $dragOverElem
    this.touchMove(evt);
    const $dragOverElem = this.get('$dragOverElem');
    if ($dragOverElem) {
      // HACK ALERT: set the dragItemData on the drop target element
      // using JQuery data since we cannot pass it any other way
      $dragOverElem.data(TOUCH_DATA_TRANSFER_KEY, this.get('data'));
      $dragOverElem.trigger('drop');
    }

    this.touchCancel(evt);
    return true;
  },

  touchCancel(evt) {
    if (!this.get('enableTouch')) {
      return false;
    }

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
  },

  focusOut() {
    this.set('isFocused', false);
  },

  keyDown(evt) {
    if (this.get('enableKeyboard')) {
      switch (evt.keyCode) {
        case 32: //space
          this.toggleProperty('isSpaceKeyTyped');
          return false;

        case 37: //left
          this._dragByKey(KEY_DRAG_DIRECTION.LEFT);
          return false;

        case 38: //up
          this._dragByKey(KEY_DRAG_DIRECTION.UP);
          return false;

        case 39: //right
          this._dragByKey(KEY_DRAG_DIRECTION.RIGHT);
          return false;

        case 40: //down
          this._dragByKey(KEY_DRAG_DIRECTION.DOWN);
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

  _dragByKey(direction) {
    // TODO find the nearest element (using findDragDropElements()) and simulate drag and dragOver, following touchMove, touchEnd and touchCancel
  }
});
