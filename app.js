// Import react funcs
const {useState} = React

// Root application code
const app = async () => {
  // Connect to the OBS websocket plugin over the network
  const {events, request} = await connect('ws://bones.local:4444')

  // Send our button set out for react to render
  return (
    <StateButton width="4" command="StartStopRecording" events={events} request={request}>
      <state update-type="RecordingStarted" class="recording">⚠️Recording in Progress</state>
      <state update-type="RecordingStopped" class="idle">OFFLINE</state>
    </StateButton>
  )
}

const StateButton = (props) => { 
  const [state, setState] = useState({
    recording: false,
    className: 'toggle-button idle'
  })

  props.events(msg => {
    // mutate state based on messages
    if(msg.updateType === 'RecordingStarted' || msg.updateType === 'RecordingStopped') {
      setState((prev) => ({
        ...prev,
        recording: msg.updateType === 'RecordingStarted',
        className: msg.updateType === 'RecordingStarted' ? 'toggle-button recording' : 'toggle-button idle'
      }))
    }
  })

  const toggle = () => {
    props.request(props.command)
  }

  return (
  <button className={state.className} role="button" onClick={toggle}>
    { state.recording ? '⚠️Recording in Progress' : 'OFFLINE'  }
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
(async function() {
  const domContainer = document.querySelector('#mount');
  ReactDOM.render(await app(), domContainer);
}())
