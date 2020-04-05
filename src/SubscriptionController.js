import EventEmitter from 'wolfy87-eventemitter';

class SubscriptionController extends EventEmitter {
    constructor() {
        super();
        this._canceled = false;
    }

    get canceled() {
        return this._canceled;
    }

    cancel() {
        if(this.canceled)
            throw new Error('canceled');
        else {
            this._canceled = true;
            this.emit('cancel');
        }
    }

    mutation() {
        let argsArray = Array.prototype.slice.call(arguments);
        this.emit.apply(this, ['mutation'].concat(argsArray));
    }

    error(error) {
        this.emit('error', error);
    }
}

export default SubscriptionController;
