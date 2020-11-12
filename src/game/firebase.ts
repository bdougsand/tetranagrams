import firebase from 'firebase';
import firebaseConfig from './firebaseConfig'

const App = firebase.initializeApp(firebaseConfig);

export default App;