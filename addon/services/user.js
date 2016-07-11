import Ember from 'ember';

export default Ember.Service.extend({
  ip: null,
  geo: null,
  geoFrom: null,
  geoWithoutIpUrl: 'https://freegeoip.net/json/',
  geoWithIpUrl: null,

  getIp() {
    let ip = this.get('ip');
    if (ip) {
      return Ember.RSVP.Promise.resolve(ip);
    }

    return new Ember.RSVP.Promise((resolve, reject) => {
      Ember.$.ajax({
        url: 'https://api.ipify.org',
        datatype: 'jsonp',
        method: 'GET'
      })
      .done((ip) => {
        this.set('ip', ip);
        this.set('geoWithIpUrl', this.get('geoWithoutIpUrl') + ip);
        resolve(ip);
      })
      .fail((reason) => {
        reject(reason);
      });
    });

  },

  getGeoFromIp() {
    let geo = this.get('geo');
    if (geo) {
      return Ember.RSVP.Promise.resolve(geo);
    }

    return new Ember.RSVP.Promise((resolve, reject) => {
      let url;
      let geoWithIpUrl = this.get('geoWithIpUrl');
      if (geoWithIpUrl) {
        url = geoWithIpUrl;
      } else {
        url = this.get('geoWithoutIpUrl');
      }
      Ember.$.ajax({
        url: url,
        datatype: 'jsonp',
        method: 'GET'
      })
      .done((value) => {
        if (!geoWithIpUrl) {
          this.set('ip', value.ip);
          this.set('geoWithIpUrl', this.get('geoWithoutIpUrl') + value.ip);
        }
        let geo = {
          country: value.country_name,
          region_name: value.region_name,
          city: value.city,
          latitude: value.latitude,
          longitude: value.longitude,
          postal_code: value.zip_code
        };
        this.set('geo', geo);
        this.set('geoFrom', 'ip');
        resolve(this.get('geo'));
      })
      .fail((reason) => {
        reject(reason);
      });
    });
  },

  requestAndSetGeoFromUser(googleApiKey) {
    //html5 geolocation request to user to get their exact coords, then reverse
    //geocode using google maps api
    let geo = this.get('geo');
    if (geo && this.get('geoFrom') === "user") {
      return Ember.RSVP.Promise.resolve(geo);
    }

    return new Ember.RSVP.Promise((resolve) => {
       window.navigator.geolocation.getCurrentPosition((position) => {
        let coords = position.coords;
        this.set('geo', {latitude: coords.latitude, longitude: coords.longitude});
        this.set('geoFrom', 'user');
        if (googleApiKey) {
          this.reverseGeocodeBasedOnCoords(coords, googleApiKey).then((value) => {
            resolve(value);
          });
        } else {
          resolve(this.get('geo'));
        }
      }, (reason) => {
        this.getGeoFromIp().then(() => {
          resolve({geo: this.get('geo'), error: reason.message});
        });
      });
    });
   },

  reverseGeocodeBasedOnCoords(coords, googleApiKey) {
    let latLong = coords.latitude+","+coords.longitude;
    let requestWebAddress = "https://maps.googleapis.com/maps/api/geocode/json?latlng="+latLong+"&key="+googleApiKey;

    return new Ember.RSVP.Promise((resolve, reject) => {
      Ember.$.ajax({
        url: requestWebAddress,
        method: 'GET'
      })
      .done((value) => {
        if (value.error_message) {
          reject({geo: this.get('geo'), error: value.error_message});
        }
        let geo = this.get('geo');
        geo.formatted_address = value.results[0].formatted_address;
        let addressComponents = value.results[0].address_components;
        for (var i = 0; i<addressComponents.length; i++) {
          let key = addressComponents[i].types[0];
          if (key === "administrative_area_level_1") {
            key = "region_name";
          }
          if (key === "locality") {
            key = "city";
          }
          geo[key] = addressComponents[i].long_name;
        }
        this.set('geo', geo);
        resolve(geo);
      })
      .fail((reason) => {
        reject(reason);
      });
    });
  }
});
