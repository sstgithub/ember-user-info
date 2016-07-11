import Ember from 'ember';

export default Ember.Controller.extend({
  user: Ember.inject.service(),
  parsedGeo: Ember.computed('user.geo', function() {
    return JSON.stringify(this.get('user.geo'));
  }),

  actions: {
    html5GeoRequest() {
      this.get('user').requestAndSetGeoFromUser(this.get('apiKey')).then((result) => {
        console.log(result);
        this.set('parsedGeo', JSON.stringify(this.get('user.geo')));
      }, (reason) => {
        console.log(reason);
      });
    },

    geoFromIp() {
      this.get('user').getGeoFromIp().then((result) => {
        console.log(result);
      });
    },

    ip() {
      this.get('user').getIp().then((result) => {
        console.log(result);
      });
    }
  }
});
