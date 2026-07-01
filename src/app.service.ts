import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHelloWord(): string {
    return 'Hello Word 2 teste teste';
  }
}
