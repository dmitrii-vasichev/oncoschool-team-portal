class ContentFactoryPublisherError(RuntimeError):
    """Raised when a Content Factory publisher cannot send safely."""

    def __init__(self, message: str, *, platform: str | None = None):
        super().__init__(message)
        self.platform = platform
