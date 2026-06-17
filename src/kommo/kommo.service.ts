import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

@Injectable()
export class KommoService {
	private readonly logger = new Logger(KommoService.name);
	private readonly baseUrl: string;
	private readonly accessToken: string;
	private lastRequestTime = 0;

	constructor(private readonly configService: ConfigService) {
		this.baseUrl = this.configService.get<string>(
			'KOMMO_BASE_URL',
			'https://genterrh.kommo.com',
		);

		this.accessToken =
			this.configService.get<string>('KOMMO_ACCESS_TOKEN') ?? '';

		if (!this.accessToken) {
			this.logger.error('No access token provided');
		}

		this.logger.log(`Kommo Service initialize with baseUrl: ${this.baseUrl}`);
	}

	// Private Helpers
	private async throttle(): Promise<void> {
		const now = Date.now();
		const elapsed = now - this.lastRequestTime;
		if (elapsed < REQUEST_DELAY_MS) {
			await this.sleep(REQUEST_DELAY_MS - elapsed);
		}
		this.lastRequestTime = Date.now();
	}

	private sleep(ms: number): Promise<number> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private resolveUrl(url: string): string {
		return url.startsWith('http') ? url : `${this.baseUrl}${url}`;
	}

	private buildJsonHeaders(): HeadersInit {
		return {
			Authorization: `Bearer ${this.accessToken}`,
			'Content-Type': 'application/json',
		};
	}
}
