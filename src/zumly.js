import {prepareCSS, setCSSVariables, renderView, notification, checkParameters } from './utils.js'

// window.requestIdleCallback = window.requestIdleCallback || shimIdleCallBack

/**
 * Zumly
 * Powers your apps with a zoomable user interface (ZUI) taste.
 * @class
 */
export class Zumly {
  /**
  * Creates a Zumly instance
  * @constructor
  * @params {Objet} options
  * @example
  *  new Zumly({
  *  mount: '.mount',
  *  initialView: 'home',
  *  views: {
  *   home,
  *   contact,
  *   ...
  *  }
  *
  */
  constructor (options) {
    // Internal state:
    // Register global instances of Zumly
    this.instance = Zumly.counter
    // Store snapshots of each zoom transition
    this.storedViews = []
    // Show current zoom level properties
    this.currentStage = null
    // Store the scale of previous zoom transition
    this.storedPreviousScale = [1]
    // Array of events useful for debugging
    this.trace = []
    // Deactive events during transtions
    this.blockEvents = false
    // Initial values for gesture events
    this.touchstartX = 0
    this.touchstartY = 0
    this.touchendX = 0
    this.touchendY = 0
    this.touching = false
    // Check if user options exist
    checkParameters(options, this)
    if (this.options) {
      // Event bindings:
      this._onZoom = this.onZoom.bind(this)
      this._onZoomInHandlerStart = this.onZoomInHandlerStart.bind(this)
      this._onZoomInHandlerEnd = this.onZoomInHandlerEnd.bind(this)
      this._onZoomOutHandlerStart = this.onZoomOutHandlerStart.bind(this)
      this._onZoomOutHandlerEnd = this.onZoomOutHandlerEnd.bind(this)
      this._onTouchStart = this.onTouchStart.bind(this)
      this._onTouchEnd = this.onTouchEnd.bind(this)
      this._onKeyUp = this.onKeyUp.bind(this)
      this._onWeel = this.onWeel.bind(this)
      // Prepare the instance:
      this.canvas = document.querySelector(this.mount)
      this.canvas.setAttribute('tabindex', 0)
      this.canvas.addEventListener('mouseup', this._onZoom, false)
      this.canvas.addEventListener('touchend', this._onZoom, false)
      this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true })
      this.canvas.addEventListener('touchend', this._onTouchEnd, false)
      this.canvas.addEventListener('keyup', this._onKeyUp, false)
      this.canvas.addEventListener('wheel', this._onWeel, { passive: true })
    } else {
      this.notify('is unable to start: no {options} have been passed to the Zumly\'s instance.', 'error')
    }
  }

  /**
   * Helpers
   */
  storeViews (data) {
    this.tracing('storedViews()')
    this.storedViews.push(data)
  }

  setPreviousScale (scale) {
    this.tracing('setPreviousScale()')
    this.storedPreviousScale.push(scale)
  }

  tracing (data) {
    if (this.debug) {
      if (data === 'ended') {
        const parse = this.trace.map((task, index) => `${index === 0 ? `Instance ${this.instance}: ${task}` : `${task}`}`).join(' > ')
        this.notify(parse)
        this.trace = []
      } else {
        this.trace.push(data)
      }
    } 
  }

  /**
   * Private methods
   */
  static get counter () {
    Zumly._counter = (Zumly._counter || 0) + 1
    return Zumly._counter
  }

  notify (msg, type) {
    return notification(this.debug, msg, type)
  }

  /**
   * Public methods
   */
  zoomLevel () {
    return this.storedViews.length
  }

  async init () {
    if (this.options) {
      // add instance style
      this.tracing('init()')
      // prepareCSS(this.instance)
      await renderView(this.initialView, this.canvas, this.views, 'init', this.componentContext)
      // add to storage. OPTIMIZAR
      this.storeViews({
        zoomLevel: this.storedViews.length,
        views: [{
          viewName: this.initialView,
          backwardState: {
            origin: '0 0',
            transform: ''
          }
        }]
      })
      //
      this.notify(`${this.instance > 1
        ? `instance nº ${this.instance} is active.`
        : `is running! Instance nº ${this.instance} is active. ${this.debug
        ? 'Debug is active, can be deactivate by setting \'debug: false\' when you define the instance.' : ''}
        More tips & docs at https://zumly.org`}`, 'welcome')
    }
  }

  /**
   * Main methods
   */
  async zoomIn (el) {
    this.tracing('zoomIn()')
    var instance = this.instance
    const canvas = this.canvas
    const coordenadasCanvas = canvas.getBoundingClientRect()
    var offsetX = coordenadasCanvas.left
    var offsetY = coordenadasCanvas.top
    const preScale = this.storedPreviousScale[this.storedPreviousScale.length - 1]
    // generated new view from activated .zoom-me element
    // generateNewView(el)
    this.tracing('renderView()')
    
    var currentView = await renderView(el, canvas, this.views, false, this.componentContext)

    if (currentView) {
      el.classList.add('zoomed')
      const coordenadasEl = el.getBoundingClientRect()
      // create new view in a template tag
      // select VIEWS from DOM
      //var currentView = canvas.querySelector('.is-new-current-view')
      var previousView = canvas.querySelector('.is-current-view')
      var lastView = canvas.querySelector('.is-previous-view')
      var removeView = canvas.querySelector('.is-last-view')
      if (removeView !== null) canvas.removeChild(removeView)
      // do changes
      const cc = currentView.getBoundingClientRect()
      const scale = cc.width / coordenadasEl.width
      const scaleInv = 1 / scale
      const scaleh = cc.height / coordenadasEl.height
      const scaleInvh = 1 / scaleh
      // muy interesante featura... usar el zoom de acuardo a la h o w mayor y agra
      var duration = el.dataset.withDuration || this.duration
      var ease = el.dataset.withEease || this.ease
      var filterIn = this.effects[0]
      var filterOut = this.effects[1]
      var cover = this.cover
  
      if (cover === 'width') {
        var laScala = scale
        var laScalaInv = scaleInv
      } else if (cover === 'height') {
        laScala = scaleh
        laScalaInv = scaleInvh
      }
  
      this.setPreviousScale(laScala)
      var transformCurrentView0 = `translate(${coordenadasEl.x - offsetX + (coordenadasEl.width - cc.width * laScalaInv) / 2}px, ${coordenadasEl.y - offsetY + (coordenadasEl.height - cc.height * laScalaInv) / 2}px) scale(${laScalaInv})`
      currentView.style.transform = transformCurrentView0
      //
      previousView.classList.add('is-previous-view')
      previousView.classList.remove('is-current-view')
      const coordenadasPreviousView = previousView.getBoundingClientRect()
      // PREVIOUS VIEW EXACTAMENTE ONDE ESTANA ANTES COMO CURRENT
      var transformPreviousView0 = previousView.style.transform
      previousView.style.transformOrigin = `${coordenadasEl.x + coordenadasEl.width / 2 - coordenadasPreviousView.x}px ${coordenadasEl.y + coordenadasEl.height / 2 - coordenadasPreviousView.y}px`
  
      const x = coordenadasCanvas.width / 2 - coordenadasEl.width / 2 - coordenadasEl.x + coordenadasPreviousView.x
      const y = coordenadasCanvas.height / 2 - coordenadasEl.height / 2 - coordenadasEl.y + coordenadasPreviousView.y
  
      const transformPreviousView1 = `translate(${x}px, ${y}px) scale(${laScala})`
      // PREVIOUS VIEW FINAL STAGE
      previousView.style.transform = transformPreviousView1
      // ACA CAMBIA LA COSA, LEVANTO LAS COORDENADAS DEL ELEMENTO CLICLEADO QUE ESTBA DNRO DE PREVIOUS VIEW
      var newcoordenadasEl = el.getBoundingClientRect()
      // LO QUE DETERMINA LA POSICINES FONAL DEL CURRENT VIEW
      var transformCurrentView1 = `translate(${newcoordenadasEl.x - offsetX + (newcoordenadasEl.width - cc.width) / 2}px, ${newcoordenadasEl.y - offsetY + (newcoordenadasEl.height - cc.height) / 2}px)`
  
      if (lastView !== null) {
        lastView.classList.remove('is-previous-view')
        lastView.classList.add('is-last-view')
        var transformLastView0 = lastView.style.transform
        var newcoordenadasPV = previousView.getBoundingClientRect()
        lastView.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px) scale(${laScala * preScale})`
        const last = lastView.querySelector('.zoomed')
        var coorLast = last.getBoundingClientRect()
        lastView.style.transform = transformLastView0
        previousView.style.transform = transformPreviousView0
        var coorPrev = previousView.getBoundingClientRect()
        var transformLastView1 = `translate(${coordenadasCanvas.width / 2 - coordenadasEl.width / 2 - coordenadasEl.x + (coorPrev.x - coorLast.x) + newcoordenadasPV.x - offsetX + (newcoordenadasPV.width - coorLast.width) / 2}px, ${coordenadasCanvas.height / 2 - coordenadasEl.height / 2 - coordenadasEl.y + (coorPrev.y - coorLast.y) + newcoordenadasPV.y - offsetY +
          (newcoordenadasPV.height - coorLast.height) / 2}px) scale(${laScala * preScale})`
      } else {
        previousView.style.transform = transformPreviousView0
      }
      // arrays
      var snapShoot = {
        zoomLevel: this.storedViews.length,
        views: []
      }
      const currentv = currentView ? {
        viewName: currentView.dataset.viewName,
        backwardState: {
          origin: currentView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformCurrentView0
        },
        forwardState: {
          origin: currentView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformCurrentView1
        }
      } : null
      const previousv = previousView ? {
        viewName: previousView.dataset.viewName,
        backwardState: {
          origin: previousView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformPreviousView0
        },
        forwardState: {
          origin: previousView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformPreviousView1
        }
      } : null
      const lastv = lastView ? {
        viewName: lastView.dataset.viewName,
        backwardState: {
          origin: lastView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformLastView0
        },
        forwardState: {
          origin: lastView.style.transformOrigin,
          duration: duration,
          ease: ease,
          transform: transformLastView1
        }
      } : null
      const gonev = removeView ? { // ACA VA LA VISTA ENTERA FALTA REALIZAR UN ZOOM IGUAL ANTES DE SACARLA DE JUEGO
        viewName: removeView
      } : null
      if (currentv !== null) snapShoot.views.push(currentv)
      if (previousv !== null) snapShoot.views.push(previousv)
      if (lastv !== null) snapShoot.views.push(lastv)
      if (gonev !== null) snapShoot.views.push(gonev)
      this.storeViews(snapShoot)
      this.currentStage = this.storedViews[this.storedViews.length - 1]
      // animation
      this.tracing('setCSSVariables()')
      // setCSSVariables('zoomIn', this.currentStage, this.instance)
      // crea animation
      // document.documentElement.style.setProperty(`--${view.name}-transform-start-${instance}`, view.stage.backwardState.transform)
      // document.documentElement.style.setProperty(`--${view.name}-transform-end-${instance}`, view.stage.forwardState.transform)
      var currentViewAnimation = currentView.animate(
        [
         { transform: transformCurrentView0 },
         { transform: transformCurrentView1 },
        ],
        { duration: 1000, fill: 'forwards' }
      )
      
      currentViewAnimation.pause()
      
      var previousViewAnimation = previousView.animate(
        [
          { transform: transformPreviousView0 },
          { transform: transformPreviousView1 },
         ],
        { duration: 1000, fill: 'forwards' }
      )
     
      previousViewAnimation.pause()
     
      if (lastView !== null) {
        var lastViewAnimation = lastView.animate(
          [
            { transform: transformLastView0 },
            { transform: transformLastView1 },
           ],
          { duration: 1000, fill: 'forwards' }
        )
      
        lastViewAnimation.pause()
      }
      
      //
      currentView.classList.remove('hide')
      // currentView.addEventListener('animationstart', this._onZoomInHandlerStart)
      
      // previousView.addEventListener('animationend', this._onZoomInHandlerEnd)
      // if (lastView !== null) lastView.addEventListener('animationend', this._onZoomInHandlerEnd)
      //
      
      // currentView.classList.add(`zoom-current-view-${instance}`)
      // previousView.classList.add(`zoom-previous-view-${instance}`)
     //  if (lastView !== null) lastView.classList.add(`zoom-last-view-${instance}`)

      let playall = () => {
        currentViewAnimation.addEventListener('finish', this._onZoomInHandlerEnd)
        this.blockEvents = true
        if (lastView !== null) lastViewAnimation.play()
        previousViewAnimation.play()
        currentViewAnimation.play()
        // previousViewAnimation.play()

      }

      playall()
      
    }

  }

  zoomOut () {
    this.tracing('zoomOut()')
    this.blockEvents = true
    this.storedPreviousScale.pop()
    var instance = this.instance
    const canvas = this.canvas
    this.currentStage = this.storedViews[this.storedViews.length - 1]
    const reAttachView = this.currentStage.views[3]
    var currentView = canvas.querySelector('.is-current-view')
    var previousView = canvas.querySelector('.is-previous-view')
    var lastView = canvas.querySelector('.is-last-view')
    //
    this.tracing('setCSSVariables()')
    setCSSVariables('zoomOut', this.currentStage, this.instance)
    //
    //
    // currentView.classList.remove('performance')
    //
    previousView.querySelector('.zoomed').classList.remove('zoomed')
    previousView.classList.remove('is-previous-view')
    previousView.classList.add('is-current-view')
    // previousView.classList.remove('performance')
    //
    if (lastView !== null) {
      lastView.classList.add('performance')
      lastView.classList.add('is-previous-view')
      lastView.classList.remove('is-last-view')
      lastView.classList.remove('hide')
    }
    //
    if (reAttachView !== undefined) {
      // aca hay que 
      canvas.prepend(reAttachView.viewName)
      var newlastView = canvas.querySelector('.z-view:first-child')
      newlastView.classList.add('hide')
    }
    //
    currentView.addEventListener('animationstart', this._onZoomOutHandlerStart)
    currentView.addEventListener('animationend', this._onZoomOutHandlerEnd)
    previousView.addEventListener('animationend', this._onZoomOutHandlerEnd)
    if (lastView !== null) lastView.addEventListener('animationend', this._onZoomOutHandlerEnd)
    //
    currentView.classList.add(`zoom-current-view-${instance}`)
    previousView.classList.add(`zoom-previous-view-${instance}`)
    if (lastView !== null) lastView.classList.add(`zoom-last-view-${instance}`)

    this.storedViews.pop()
  }

  /**
   * Event hangling
   */
  onZoom (event) {
    if (this.storedViews.length > 1 && !this.blockEvents && !event.target.classList.contains('zoom-me') && event.target.closest('.is-current-view') === null && !this.touching) {
      this.tracing('onZoom()')
      event.stopPropagation()
      this.zoomOut()
    }
    if (!this.blockEvents && event.target.classList.contains('zoom-me') && !this.touching) {
      this.tracing('onZoom()')
      event.stopPropagation()
      this.zoomIn(event.target)
    }
  }

  onKeyUp (event) {
    this.tracing('onKeyUp()')
    // Possible conflict with usar inputs
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (this.storedViews.length > 1 && !this.blockEvents) {
        this.zoomOut()
      } else {
        this.notify(`is on level zero. Can't zoom out. Trigger: ${event.key}`, 'warn')
      }
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.notify(event.key + 'has not actions defined')
    }
  }

  onWeel (event) {
    // inertia need to be fixed
    if (!this.blockEvents) {
      this.tracing('onWeel()')
      if (event.deltaY < 0) {}
      if (event.deltaY > 0) {
        if (this.storedViews.length > 1 && !this.blockEvents) {
          this.zoomOut()
        } else {
          // this.notify("is on level zero. Can't zoom out. Trigger: wheel/scroll", 'warn')
        }
      }
    }
  }

  onTouchStart (event) {
    this.tracing('onTouchStart()')
    this.touching = true
    this.touchstartX = event.changedTouches[0].screenX
    this.touchstartY = event.changedTouches[0].screenY
  }

  onTouchEnd (event) {
    if (!this.blockEvents) {
      this.tracing('onTouchEnd()')
      this.touchendX = event.changedTouches[0].screenX
      this.touchendY = event.changedTouches[0].screenY
      this.handleGesture(event)
      // event.preventDefault()
    }
  }

  handleGesture (event) {
    event.stopPropagation()
    this.tracing('handleGesture()')
    if (this.touchendX < this.touchstartX - 30) {
      if (this.storedViews.length > 1 && !this.blockEvents) {
        this.tracing('swipe left')
        this.zoomOut()
      } else {
        this.notify("is on level zero. Can't zoom out. Trigger: Swipe left", 'warn')
      }
    }
    if (this.touchendY < this.touchstartY - 10) {
      if (this.storedViews.length > 1 && !this.blockEvents) {
        this.tracing('swipe up')
        // Disabled. In near future enable if Zumly is full screen
        // this.zoomOut()
      } else {
        this.notify("is on level zero. Can't zoom out. Trigger: Swipe up", 'warn')
      }
    }
    if (this.touchendY === this.touchstartY && !this.blockEvents && event.target.classList.contains('zoom-me') && this.touching) {
      this.touching = false
      this.tracing('tap')
      event.preventDefault()
      this.zoomIn(event.target)
    }
    if (this.touchendY === this.touchstartY && this.storedViews.length > 1 && !this.blockEvents && !event.target.classList.contains('zoom-me') && event.target.closest('.is-current-view') === null && this.touching) {
      this.touching = false
      this.tracing('tap')
      this.zoomOut()
    }
  }

  onZoomOutHandlerStart (event) {
    this.tracing('onZoomOutHandlerStart()')
  }

  onZoomOutHandlerEnd (event) {
    this.tracing('onZoomOutHandlerEnd()')
    const element = event.target
    var currentZoomLevel = this.currentStage
    element.removeEventListener('finish', this._onZoomOutHandlerEnd)
    // current
    if (element.classList.contains(`zoom-current-view-${this.instance}`)) {
      try {
        this.canvas.removeChild(element)  
      } catch(e) {
        console.debug("Error when trying to remove element after zoom out. Trying to remove its parent instead...")
        try {
          this.canvas.removeChild(element.parentElement)  
        } catch(e) {
          console.debug("Error when trying to remove elemont after zoom out:", e)
          console.debug("Element to remove was:", element)
        }
        
      }
      
      this.blockEvents = false
    }
    if (element.classList.contains(`zoom-previous-view-${this.instance}`)) {
      var origin = currentZoomLevel.views[1].backwardState.origin
      var transform = currentZoomLevel.views[1].backwardState.transform
      element.classList.remove('performance')
      element.classList.remove(`zoom-previous-view-${this.instance}`)
      element.style.transformOrigin = `0 0`
      element.style.transform = transform
      //element.style.filter = 'none'
      if (currentZoomLevel.views.length === 2) this.tracing('ended')
    }
    if (element.classList.contains(`zoom-last-view-${this.instance}`)) {
      origin = currentZoomLevel.views[2].backwardState.origin
      transform = currentZoomLevel.views[2].backwardState.transform
      element.classList.remove('performance')
      element.classList.remove(`zoom-last-view-${this.instance}`)
      element.style.transformOrigin = origin
      element.style.transform = transform
      if (currentZoomLevel.views.length > 2) this.tracing('ended')
    }
  }

  onZoomInHandlerStart (event) {
    this.tracing('onZoomInHandlerStart()')
  }

  onZoomInHandlerEnd (event) {
    console.log('PUTO', event)
    this.tracing('onZoomInHandlerEnd()')
    // current view
    var cv = event.target.effect.target
    var pv = this.canvas.querySelector('.is-previous-view')
    var lv = this.canvas.querySelector('.is-last-view')
    var currentZoomLevel = this.currentStage
    this.blockEvents = false
    cv.classList.remove('is-new-current-view')
    cv.classList.add('is-current-view')
    cv.classList.remove('has-no-events')
    let animations = document.getAnimations()
    animations.forEach(a => a.commitStyles())
    console.log(animations)
    document.getAnimations()[0].removeEventListener('finish', this._onZoomInHandlerEnd)

    // cv.style.transformOrigin = currentZoomLevel.views[0].forwardState.origin
    cv.style.transform = currentZoomLevel.views[0].forwardState.transform
    if (pv) {
    //  pv.style.transformOrigin = currentZoomLevel.views[1].forwardState.origin
      pv.style.transform = currentZoomLevel.views[1].forwardState.transform
    }
    if (lv) {
   //   lv.style.transformOrigin = currentZoomLevel.views[2].forwardState.origin
      lv.style.transform = currentZoomLevel.views[2].forwardState.transform
    } 
    // event.removeEventListener('finish', this._onZoomInHandlerEnd)
  }
}
