export default class PrivateWorker {
	worker
	custom_worker
	callback
	worker_name
	app
	constructor(custom_worker, worker_name, callback, app) {
		this.custom_worker = custom_worker
		this.worker_name = worker_name
		this.callback = callback
		this.app = app
	}
	createWorker(custom_worker, worker_name) {
		return new Promise((resolve, reject) => {
			const worker = new custom_worker({
				type: 'module',
				credentials: 'same-origin',
				name: worker_name
			})
			worker.onmessage = (e) => {
				if (e.data === 'ready') {
					resolve(worker);
				}
			};
			worker.onerror = reject;
		});
	}
	async init() {
		try {

			this.worker = await this.createWorker(this.custom_worker, this.worker_name)
			this.worker.onmessage = this.callback
			this.worker.postMessage({
				type: 'INIT_WORKER',
				url_fe: this.app.config.globalProperties.$request_fe_domain,
				url_be: this.app.config.globalProperties.$request_be_domain
			})
			return this.worker
		} catch (error) {
			console.error('Worker initialization failed:', error)
		}
	}
	terminate() {
		this.broadcast.close()
		this.worker.terminate()
	}
}