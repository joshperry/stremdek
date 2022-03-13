// Import react funcs
const {useState, useEffect} = React

// Root application code
const App = () => {
  // Map OBS events to state transitions
  const [state, setState] = useState({
    connected: false,
    events: null,
    requests: null,

    recording: false,
    scene: ''
  })

  // Connect to the OBS websocket plugin over the network
  useEffect(async () => {
    console.log('connecting')
    const {events, request} = await connect('ws://bones.local:4444')
    console.log('completed connection')
    setState(state => ({
      ...state,
      connected: true,
      events,
      request
    }))

    events(msg => {
      switch(msg.updateType) {
        case 'RecordingStarted':
          setState(state => ({ ...state, recording: true }))
          break;
        case 'RecordingStopped':
          setState(state => ({ ...state, recording: false }))
          break;
        case 'TransitionEnd':
          setState(state => ({ ...state, scene: msg['to-scene'] }))
          break;
      }
    })
  }, [])

  if(!state.connected) {
    return (
        <h3>
          Connecting...
        </h3>
    )
  }

  // Send our button set out for react to render
  return (
    <React.StrictMode>
      <div id="container">
      <ToggleButton state={state.recording} row="1" column="1/5" name="recording" command="StartStopRecording" request={state.request}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">Not Recording</span>
      </ToggleButton>

      <ToggleButton state={state.scene === 'game'} row="2" name="recording" command="SetCurrentScene" params={{'scene-name': 'game'}} request={state.request}>
        <img height="50px" src="https://cdn4.iconfinder.com/data/icons/SUNNYDAY/graphics/png/400/scene.png"/> Game
      </ToggleButton>
      <ToggleButton state={state.scene === 'Full Vid'} row="2" name="recording" command="SetCurrentScene" params={{'scene-name': 'Full Vid'}} request={state.request}>
        Full Vid
      </ToggleButton>

      <ToggleButton state={state.recording} row="2" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>
      <ToggleButton state={state.recording} row="2" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>

      <CommandButton row="3" column="1/3" name="recording" command="SaveReplayBuffer" request={state.request}>
        CLIP IT, Chat!
      </CommandButton>
      <ToggleButton state={state.recording} row="3" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>
      <ToggleButton state={state.recording} row="3" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>

      <ToggleButton state={state.recording} row="4" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>
      <ToggleButton state={state.recording} row="4" column="2/5" name="recording" on="RecordingStarted" off="RecordingStopped" events={state.events}>
        <span className="oncontent">⚠️Recording in Progress</span>
        <span className="offcontent">OFFLINE</span>
      </ToggleButton>
    </div>
    </React.StrictMode>
  )
}

const ToggleButton = (props) => { 
  const toggle = async () => {
    if(props.command) {
      try {
        await props.request(props.command, props.params)
      } catch(err) {
        console.log(`error sending command: ${err}`)
      }
    }
  }

  return (
  <button className={`toggle-button ${props.name} ${props.state?'on':'off'}`} style={{gridColumn: props.column, gridRow: props.row}} role="button" onClick={toggle}>
    {props.children}
  </button>
  )
}

const CommandButton = (props) => { 
  const send = async () => {
    try {
      await props.request(props.command, props.params)
    } catch(err) {
      console.log(`error sending command: ${err}`)
    }
  }

  return (
  <button className={`command-button ${props.name}`} style={{gridColumn: props.column, gridRow: props.row}} role="button" onClick={send}>
    {props.children}
  </button>
  )
}

const guid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  .replace(/[xy]/g, c => {  
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);  
      return v.toString(16);  
   })

const connect = host => {
  return new Promise((resolve, reject) => {
    console.log('in connect')
    let listeners = []
    let completions = {}

    const ws = new WebSocket(host);

    // Handle messages we get from OBS
    ws.addEventListener('message', event => {
      console.log(`got message ${event.data}`)

      // Parse out the message
      const raw = JSON.parse(event.data)
      const msg = {
        ...raw,
        updateType: raw['update-type'],
        messageId: raw['message-id'],
      }

      // Dispatch it to listeners
      for(const f of listeners) {
        f(msg)
      }

      // Check if this is a completion response
      const c = completions[msg.messageId]
      if(c){
        delete completions[msg.messageId]
        if(msg.status === 'ok') {
          console.log('got good completion')
          c.resolve(msg)
        } else {
          console.log('got reject completion')
          c.reject(msg.error)
        }
      }
    })

    // Function for buttons to subscribe to the OBS event stream
    const events = f => {
      listeners = [...listeners, f]
    }

    // Function for buttons to send requests to OBS
    const request = (command, params={}) => new Promise((resolve, reject) => {
      const id = guid()
      // Kick off the request
      ws.send(JSON.stringify({
        ...params,
        'request-type': command,
        'message-id': id,
      }))

      // Store this pending request in the completions list
      completions = {
        ...completions,
        [id]: {resolve, reject},
      }
    })

    ws.onopen = (event) => {
      console.log(`connected to OBS`)
      ws.onclose = null // stop watching for errors
      resolve({events, request})
    }

    ws.onclose = (event) => {
      if(!event.wasClean) {
        console.log(`FAILED connection to OBS: ${event.reason}`)
        reject(event.reason)
      }
    }
  })
}

// Mount the application into the DOM
const domContainer = document.querySelector('#mount');
ReactDOM.render((<App/>), domContainer);
twemoji.parse(document.body);
