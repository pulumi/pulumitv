import React, { useState, useEffect } from 'react';
import logo from "./logo.svg";
import "./App.css";

export default function App() {
  const apiEndpoint = process.env.REACT_APP_API_ENDPOINT;
  const [apiResult, setApiResult] = useState("loading...");

  useEffect(() => {
    if (apiEndpoint) {
      const resp = fetch(apiEndpoint);
      resp.then((res) => res.json().then((json) => setApiResult(JSON.stringify(json))));
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Endpoint: {apiEndpoint}
        </p>
        <p>
          Result: {apiResult}
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
