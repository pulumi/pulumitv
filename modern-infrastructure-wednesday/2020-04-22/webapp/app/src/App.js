import React, { useState, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  let [status, setStatus] = useState(null);
  useEffect(() => {
    async function fetchData() {
      const s = await fetch("https://webapp.pulumi.tv/api");
      setStatus(await s.json());
      console.log(s);
    }
    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          I made a change!
          {status?.status}
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
