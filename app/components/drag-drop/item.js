import Ember from 'ember';

// IE11 and Edge only support "text"
const DATA_TRANSFER_TYPE = 'text';

export default Ember.Component.extend({
  // PASSED IN
  data: '', // REQUIRED - a string to pass along with the element
  isDraggable: false, // use this flag to turn on/off dragging behavior
  isDroppable: false, // use this flag to enable/disable this element as a drop target
  dragHandleSelector: null, // (optional) a CSS selector of the part of this element from
 														// where a drag can be initiated

  // SHOULD PROBABLY BE PRIVATE
  dragEffectAllowed: 'all', // HTML5 drag property that tells the drop area which kinds of actions
  													// are supported by this draggable element when it is dropped
  dropEffect: 'move', // HTML5 drop property that indicates what kind of action will occur
  										// when an element is dropped on this element

  // PRIVATE
  isHovered: false, // can't use :hover because of a webkit bug with :hover being overly persistent
 										// with drag and drop: http://stackoverflow.com/questions/17946886/hover-sticks-to-element-on-drag-and-drop
  isDragging: false,
  isDraggedOver: false,
  dragTarget: null, // the target element of the drag (which part of the element the mouse is on)
  $dragGhost: null, // the JQuery element that we are moving around with the drag
  									// we do this because HTML5 drag and drop doesn't do a good job with that

  classNames: ['drag-drop'],
  classNameBindings: [
    'isHovered:drag-drop--hovered',
    'isDraggable:drag-drop--draggable',
    'isDragging:drag-drop--dragging',
    'isDroppable:drag-drop--droppable',
    'isDraggedOver:drag-drop--dragged-over'
  ],

  attributeBindings: ['data:data-drag-drop-data'],

  actions: {
    /* BEGIN REGULAR MOUSE EVENTS *******************/
    mouseEnter() {
      this.set('isHovered', true);
    },

    mouseLeave() {
      this.set('isHovered', false);
    },

    mouseDown(evt) {
      this.set('dragTarget', evt.target);
    },

    mouseUp() {
      this.set('dragTarget', null);
    },

    /* BEGIN DRAGGABLE EVENTS *******************/
    dragStart(evt) {
      if (!this._shouldAllowDragStart()) {
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

      // TODO touch events don't have dataTransfer. If we get this to work for touch, then we can probably get rid of this for HTML5 drag/drop
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
    if (this.get('isDroppable')) {
      this.set('isDraggedOver', true);
      evt.dataTransfer.dropEffect = this.get('dropEffect');

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
    if (this.get('isDroppable')) {
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
    if (this.get('isDroppable')) {
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
    if (this.get('isDroppable')) {
      this.set('isDraggedOver', false);
      this.sendAction(
        'onDrop',
        this._eventData(evt, {
          dragData: evt.dataTransfer.getData(DATA_TRANSFER_TYPE),
          dropData: this.get('data')
        })
      );
    }

    evt.preventDefault();
  },

  /* BEGIN TOUCH EVENTS **************/

  // TODO map these events: mouseleave, mouseup | dragstart(evt), drag(evt), dragend(evt)

  touchStart(evt) {
    console.log('touchStart ' + this.get('data'));

    this.send('mouseEnter');
    this.send('mouseDown', evt);
  },

  touchMove(evt) {
    console.log('touchMove ' + this.get('data'));

    if (!this.get('isDragging')) {
      this.send('dragStart', evt);
    }
    this.send('drag', evt);
  },

  touchEnd(evt) {
    console.log('touchEnd ' + this.get('data'));

    if (this.get('isDragging')) {
      this.send('dragEnd', evt);
    }
    this.send('mouseUp', evt);
    this.send('mouseLeave');
  },

  touchCancel(evt) {
    console.log('touchCancel ' + this.get('data') + ', forwarding to touchEnd');
    this.send('touchEnd', evt);
  },

  /* BEGIN HELPERS *******************/
  _shouldAllowDragStart() {
    const dragHandleSelector = this.get('dragHandleSelector');
    if (!dragHandleSelector) {
      return true; // we don't care where the drag was initiated
    }

    // make sure the drag was initiated by the specified drag handle
    const dragTarget = this.get('dragTarget');
    return Ember.$(dragTarget).is(dragHandleSelector);
  },

  _createDragGhost() {
    const $dragGhost = this.$('.drag-drop__drag-content')
      .clone()
      .addClass('drag-drop__drag-content--ghost')
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
        right: 0,
        bottom: 0,
        'z-index': -1
      });

    this.$().append($dragGhost);

    this.set('$dragGhost', $dragGhost);
    return $dragGhost;
  },

  _clearDragGhost() {
    const $dragGhost = this.get('$dragGhost');
    if ($dragGhost) {
      $dragGhost.remove();
    }
    this.set('$dragGhost', null);
  },

  _eventData(evt, extraParams) {
    const params = (evt && evt.originalEvent) || evt;

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
  }
});

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
