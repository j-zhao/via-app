import {Provider} from 'react-redux';
import {Router} from 'wouter';

import {store} from '../store';
import Routes from '../Routes';

export default () => (
  <Provider store={store}>
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes />
    </Router>
  </Provider>
);
