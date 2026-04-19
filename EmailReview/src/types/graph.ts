/** Subset of Microsoft Graph message resource relevant to this app. */
export interface GraphMessage {
  id: string;
  conversationId: string;
  internetMessageId?: string;
  subject: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime?: string;
  isRead: boolean;
  categories: string[];
  bodyPreview: string;
  body?: {
    contentType: string;
    content: string;
  };
  importance: string;
  hasAttachments: boolean;
  parentFolderId: string;
}

export interface GraphMessageListResponse {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface GraphMailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}
