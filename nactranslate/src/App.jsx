import './index.css'
// import './App.css'
import MicrophoneCapture from './MicrophoneCapture'

const App = () => {

  return(<>
      <div className="app-container">
        <header className="app-header">
          <div className="app-logo"></div>
          <h1 className="app-title">NAC Translate</h1>
          <p className="app-subtitle">Offline AI Translation • Privacy First</p>
        </header>
      <MicrophoneCapture />
      </div>
  </>)

}

export default App