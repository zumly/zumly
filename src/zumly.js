import {renderView, notification, validateUserSettings } from './utils.js'

/**
 * Zumly
 * Powers your apps with a zoomable user interface (ZUI) taste.
 * @class
 */
export class Zumly {
  /**
  * Creates a Zumly instance
  * @constructor
  * @params {Object} settings
  * @example
  *  new Zumly({
  *  mount: '.mount',
  *  initialView: 'home',
  *  views: {
  *   home,
  *   contact,
  *   ...
  *  },
  * debug: false
  * 
  */
  constructor (settings) {
    // Internal state:
    // Usser settings available properties
    // Check if user settings exist
    this.validated = validateUserSettings(settings)
    if (this.validated) {
      // set user properties
      this.initialView = settings.initialView
      this.views = settings.views || {}
      this.componentContext = settings.componentContext || null
      this.duration = settings.zoom_duration || 1000
      this.ease =  settings.zoom_ease  || 'ease-in-out'
      this.debug =  settings.debug || false
      this.cover =  settings.zoom_cover || 'width'
      this.effects =  settings.zoom_effects || ['none', 'none']
      this.canvas = document.querySelector(settings.mount)
      // Register global instances of Zumly
      this.instance = Zumly.counter
      // 
      this.currentLevel = []
      // Store snapshots of each zoom transition
      this.storedViews = []
      // Show current zoom level properties
      this.currentStage = null
      // Store the scale of previous zoom transition
      this.storedPreviousScale = [1]
      // Deactive events during transtions
      this.blockEvents = false
      // Initial values for gesture events
      this.touchstartX = 0
      this.touchstartY = 0
      this.touchendX = 0
      this.touchendY = 0
      this.touching = false
      // Event bindings:
      this._onZoom = this.onZoom.bind(this)
      this._onTouchStart = this.onTouchStart.bind(this)
      this._onTouchEnd = this.onTouchEnd.bind(this)
      this._onKeyUp = this.onKeyUp.bind(this)
      this._onWeel = this.onWeel.bind(this)
      // Prepare the instance:
      this.canvas.setAttribute('tabindex', 0)
      this.canvas.addEventListener('mouseup', this._onZoom, false)
      this.canvas.addEventListener('touchend', this._onZoom, false)
      this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true })
      this.canvas.addEventListener('touchend', this._onTouchEnd, false)
      this.canvas.addEventListener('keyup', this._onKeyUp, false)
      this.canvas.addEventListener('wheel', this._onWeel, { passive: true })
     // auto execute
      this.init()
    }
  }

  /**
   * Helpers
   */
  storeViews (data) {
   if (this.storedViews.length > 1) {
    let lastElementCopy = this.storedViews[this.storedViews.length - 1]
    lastElementCopy.map(d => {
      if (d.hasOwnProperty('view') && d.position !== 'toRemove') {
        d.viewName = d.view.dataset.viewName
        delete d.view
      } 
    })
    this.storedViews.pop()
    this.storedViews.push(lastElementCopy)
   }
  this.storedViews.push(data)
  this.setCurrentStage()
  }

  popStoredViews() {
    this.storedViews.pop()
    this.setCurrentStage()
  }

  setCurrentStage () {
    this.currentStage = this.storedViews[this.storedViews.length - 1]
  }

  setPreviousScale (scale) {
    this.storedPreviousScale.push(scale)
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
    if (this.validated) {
      await renderView(this.initialView, this.canvas, this.views, 'init', this.componentContext)
      this.setZoomLevelState(this.initialView, true)
      this.notify(`${this.instance > 1 ? 
      `instance nº ${this.instance} is active.\n` : 
      `is running! Instance nº ${this.instance} is active.\n`}`, 'welcome')
      if (this.debug) {
        this.notify(`Debug is active, can be deactivate by setting \'debug: false\' when you define the instance.\n'`, 'welcome')
        this.notify(`More tips & docs at https://zumly.org`, 'welcome')
      }
    }
  }
  setState (position, view, duration, ease, origin, transformO, transform1) {
    if (view) {
      return {
        position: position,
        element: view,
        duration: duration,
        ease: ease,
        origin: origin,
        transform: [transformO, transform1]
      }
    } else {
      return null
    }
  }
  setZoomLevelState (viewState, initial) {
    var snapShoot = []
    if (initial) {
      snapShoot.push({
        viewName: viewState,
        position: 'current',
        backward: {
          origin: '0 0',
          transform: 'translate(0, 0)'
        }
      })
    } else {
      viewState.forEach((view, index) => {
        if (index < 3) {
          var zoomViewState = {
            viewName: null,
            view: view.element,
            position: view.position,
            backward: {
              duration: view.duration,
              ease: view.ease,
              origin: view.origin,
              transform: view.transform[0]
            },
            forward: {
              duration: view.duration,
              ease: view.ease,
              origin: view.origin,
              transform: view.transform[1]
            }
          }
        } else {
          zoomViewState = {
            position: view.position,
            view : view.element
          }
        }
        snapShoot.push(zoomViewState)
      })
    }
    this.storeViews(snapShoot)
    console.log(this.storedViews)
  }

  setZoomIn () {
    // Just before first animation has started, fires an event
    this.blockEvents = true
    const zoomInStarted = new Event('zoom-in-started')
    let stage = this.currentStage
    stage.forEach((s, index) => {
      if (index < 3) {
        var animationStage = s.view.animate(
          [
            { transform: stage.length === 2 && s.position === 'previous' ? 'translate(0, 0)'  : s.backward.transform },
            { transform: s.forward.transform }
          ],
          { duration: 1000, easing: s.forward.ease}
        )
        s.view.classList.remove('hide')       
        animationStage.pause()
        animationStage.onfinish = event => {
          if (s.position === 'current') {
            this.blockEvents = false
            s.view.classList.replace('is-new-current-view', 'is-current-view')
          }
          s.view.classList.remove('performance')
          s.view.classList.remove('has-no-events')
          s.view.style.transformOrigin = s.forward.origin
          s.view.style.transform = s.forward.transform
          // After last animation finished, fires an event
          if (s.position === 'current') {
            const zoomInFinished = new Event('zoom-in-finished')
            s.view.dispatchEvent(zoomInFinished)
          }
        }
        s.view.dispatchEvent(zoomInStarted)
        animationStage.play()
      }
    })
  }

  setZoomOut () {
    this.blockEvents = true
    const zoomOutStarted = new Event('zoom-out-started')
    let stage = this.currentStage
    stage.forEach((s, index) => {
      if (s.position === 'current') {
        s.view.dispatchEvent(zoomOutStarted)
      }
      if (s.position !== 'toRemove' && s.view !== null) {
        var animationStage = s.view.animate(
          [
            { transform: s.forward.transform },
            { transform: stage.length === 2 && s.position === 'previous' ? 'translate(0, 0)' : s.backward.transform }
          ],
          { duration: 1000, easing: s.backward.ease}
        )
        // s.view.classList.remove('hide')       
        animationStage.pause()
        animationStage.onfinish = event => {
          if (s.position === 'current') {
            this.blockEvents = false
            const zoomOutFinished = new Event('zoom-out-finished')
            s.view.dispatchEvent(zoomOutFinished)
            s.view.remove()
            let reattach = stage.find(d => d.position === 'toRemove')
            if (reattach) {
              this.canvas.prepend(reattach.view)
              let newlastView = this.canvas.querySelector('.z-view:first-child')
              newlastView.classList.add('hide')
            }
            this.popStoredViews()
          } else if (s.position !== 'current') {
            s.view.style.transformOrigin = s.position ==='previous' ? '0 0' : s.backward.origin
            s.view.style.transform = s.backward.transform
          }
        }
        animationStage.play()
      }
    })
  }

  /**
   * Main methods
   */
  async zoomIn (el) {
   // RENDER
    var canvas = this.canvas
    var currentView = await renderView(el, canvas, this.views, false, this.componentContext)
    if (currentView) {
      // SELECCION DE ELEMENTOS
      var previousView = canvas.querySelector('.is-current-view')
      var lastView = canvas.querySelector('.is-previous-view')
      if (lastView !== null) {var removeView = canvas.querySelector('.is-last-view')}
      // CLASES
      el.classList.add('zoomed')
      previousView.classList.replace('is-current-view', 'is-previous-view')
      if (lastView !== null) lastView.classList.replace('is-previous-view', 'is-last-view')
      // OBTENER MEDIDAS
      var coordsCanvas = canvas.getBoundingClientRect()
      var coordsEl = el.getBoundingClientRect()
      var coordsCurrentView = currentView.getBoundingClientRect()
      var coordsPreviousView = previousView.getBoundingClientRect()
      if (lastView !== null && removeView !== null) removeView.remove()
      // MEDIDAS AUXILIARES
      var offsetX = coordsCanvas.left
      var offsetY = coordsCanvas.top
      var previousScale = this.storedPreviousScale[this.storedPreviousScale.length - 1]
      // ELEMENTO ZOOMEABLE ACTIVO
      // Obtengo coords del elemento zoomeable qie seran usadas para el estado inical de la vista nueva
      var scale = coordsCurrentView.width / coordsEl.width
      var scaleInv = 1 / scale
      var scaleh = coordsCurrentView.height / coordsEl.height
      var scaleInvh = 1 / scaleh
      var cover = this.cover
      if (cover === 'width') {
        var coverScale = scale
        var coverScaleInv = scaleInv
      } else if (cover === 'height') {
        coverScale = scaleh
        coverScaleInv = scaleInvh
      }
      // Opciones
      var duration = el.dataset.withDuration || this.duration
      var ease = el.dataset.withEease || this.ease
      var filterIn = this.effects[0]
      var filterOut = this.effects[1]
      // set CurrentView transform (new Current)
      let currentX = coordsEl.x - offsetX + (coordsEl.width - coordsCurrentView.width * coverScaleInv) / 2
      let currentY = coordsEl.y - offsetY + (coordsEl.height - coordsCurrentView.height * coverScaleInv) / 2
      // Set previousView transform (ex CurrentView)
      let previousOriginX = coordsEl.x + coordsEl.width / 2 - coordsPreviousView.x
      let previousOriginY = coordsEl.y + coordsEl.height / 2 - coordsPreviousView.y
      // calculate final estate
      var previousX = coordsCanvas.width / 2 - coordsEl.width / 2 - coordsEl.x + coordsPreviousView.x
      var previousY = coordsCanvas.height / 2 - coordsEl.height / 2 - coordsEl.y + coordsPreviousView.y
      //// 0
      var transformCurrentView0 = `translate(${currentX}px, ${currentY}px) scale(${coverScaleInv})`
      var transformPreviousView0 = previousView.style.transform
      if (lastView !== null)  var transformLastView0 = lastView.style.transform
      ///////////// 1
      // Apply previousView transform 1
      previousView.style.transformOrigin = `${previousOriginX}px ${previousOriginY}px`
      previousView.style.transform = `translate(${previousX}px, ${previousY}px) scale(${coverScale})`
      if (lastView !== null) lastView.style.transform = `translate(${previousX - offsetX}px, ${previousY - offsetY}px) scale(${coverScale * previousScale})`
      // recapture El coords
      var newCoordsEl = el.getBoundingClientRect()
      if (lastView !== null) { 
        var coordsLastViewEl = lastView.querySelector('.zoomed').getBoundingClientRect()
        var newCoordsPreviousView = previousView.getBoundingClientRect()
        var lastX = coordsCanvas.width / 2 - coordsEl.width / 2 - coordsEl.x + (coordsPreviousView.x - coordsLastViewEl.x) + newCoordsPreviousView.x - offsetX + (newCoordsPreviousView.width - coordsLastViewEl.width) / 2
        var lastY = coordsCanvas.height / 2 - coordsEl.height / 2 - coordsEl.y + (coordsPreviousView.y - coordsLastViewEl.y) + newCoordsPreviousView.y - offsetY + (newCoordsPreviousView.height - coordsLastViewEl.height) / 2
      }
      // final state trasnform views
      var transformCurrentView1 = `translate(${newCoordsEl.x - offsetX + (newCoordsEl.width - coordsCurrentView.width) / 2}px, ${newCoordsEl.y - offsetY + (newCoordsEl.height - coordsCurrentView.height) / 2}px)`
      var transformPreviousView1 =  previousView.style.transform 
      if (lastView !== null) var transformLastView1 = `translate(${lastX}px, ${lastY}px) scale(${coverScale * previousScale})`
      //
      var viewState = [
        this.setState('current', currentView, duration, ease, currentView.style.transformOrigin, transformCurrentView0, transformCurrentView1), 
        this.setState('previous', previousView, duration, ease, previousView.style.transformOrigin, transformPreviousView0, transformPreviousView1),
        lastView && this.setState('last', lastView, duration, ease, lastView.style.transformOrigin, transformLastView0, transformLastView1),
        removeView && this.setState('toRemove', removeView)
      ].filter(e => e)
      this.setZoomLevelState(viewState)
      this.setPreviousScale(coverScale)
      // Apply  initial states
      requestAnimationFrame(() => {
        currentView.style.transform = transformCurrentView0
        previousView.style.transform = transformPreviousView0
        if (lastView !== null) lastView.style.transform = transformLastView0
      })
      // animation
      this.setZoomIn()
    }
  }

  zoomOut () {
    this.storedPreviousScale.pop()
    var currentView = this.canvas.querySelector('.is-current-view')
    var previousView = this.canvas.querySelector('.is-previous-view')
    var lastView = this.canvas.querySelector('.is-last-view')
    previousView.querySelector('.zoomed').classList.remove('zoomed')
    previousView.classList.replace('is-previous-view', 'is-current-view')
    if (lastView !== null) {
      lastView.classList.replace('is-last-view', 'is-previous-view')
      lastView.classList.remove('hide')
    }

    this.currentStage = this.currentStage.map(c => {
      if (c.position === 'current') c.view = currentView
      if (c.position === 'previous') c.view = previousView
      if (c.position === 'last') c.view = lastView
      return c
    })
    
    this.setZoomOut()
    
  }
  /**
   * Event hangling
   */
  onZoom (event) {
    if (this.storedViews.length > 1 && !this.blockEvents && !event.target.classList.contains('zoom-me') && event.target.closest('.is-current-view') === null && !this.touching) {
      event.stopPropagation()
      this.zoomOut()
    }
    if (!this.blockEvents && event.target.classList.contains('zoom-me') && !this.touching) {
      event.stopPropagation()
      this.zoomIn(event.target)
    }
  }

  onKeyUp (event) {
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
    // Inertia may need to be fixed
    if (!this.blockEvents && event.deltaY > 0 && this.storedViews.length > 1 && !this.blockEvents) 
      this.zoomOut()
  }

  onTouchStart (event) {
    this.touching = true
    this.touchstartX = event.changedTouches[0].screenX
    this.touchstartY = event.changedTouches[0].screenY
  }

  onTouchEnd (event) {
    if (!this.blockEvents) {
      this.touchendX = event.changedTouches[0].screenX
      this.touchendY = event.changedTouches[0].screenY
      this.handleGesture(event)
    }
  }

  handleGesture (event) {
    event.stopPropagation()
    if (this.touchendX < this.touchstartX - 30) {
      if (this.storedViews.length > 1 && !this.blockEvents) {
        this.zoomOut()
      } else {
        this.notify("is on level zero. Can't zoom out. Trigger: Swipe left", 'warn')
      }
    }
    if (this.touchendY < this.touchstartY - 10) {
      if (this.storedViews.length > 1 && !this.blockEvents) {
        // Disabled. In futuree may b enable if Zumly is full screen
        // this.zoomOut()
      } else {
        this.notify("is on level zero. Can't zoom out. Trigger: Swipe up", 'warn')
      }
    }
    if (this.touchendY === this.touchstartY && !this.blockEvents &&
      event.target.classList.contains('zoom-me') && this.touching) {
      this.touching = false
      event.preventDefault()
      this.zoomIn(event.target)
    }
    if (this.touchendY === this.touchstartY && this.storedViews.length > 1 && 
      !this.blockEvents && !event.target.classList.contains('zoom-me') && 
      event.target.closest('.is-current-view') === null && this.touching) {
      this.touching = false
      this.zoomOut()
    }
  }
}
