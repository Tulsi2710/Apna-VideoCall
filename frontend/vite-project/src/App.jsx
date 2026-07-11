import { useState } from 'react';
import {Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import LandingPage from './pages/landing';
import Authentication from './pages/Authentication';
import HomeComponent from './pages/home';
import History from './pages/history';
import { AuthProvider } from './context/AuthContext';
import VideoMeetComponent from './pages/videoMeet';

function App() {
  // const [count, setCount] = useState(0)

  return (
   <div className='App'>


    {/* <Router> */}

      <AuthProvider>

      <Routes>

        <Route path='/' element={<LandingPage />} />
        <Route path='/auth' element={<Authentication />} />
        <Route path='/history' element={<History />} />
        <Route path='/home' element={<HomeComponent />} />
        <Route path='/:url' element={<VideoMeetComponent />} />
      </Routes>

      </AuthProvider>
      
    {/* </Router> */}

   </div>
  )

}

export default App;
